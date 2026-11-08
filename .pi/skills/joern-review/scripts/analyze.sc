import io.shiftleft.semanticcpg.language.*
import io.shiftleft.codepropertygraph.generated.nodes.*

/** Export bounded observations, not inferred contracts or data-flow claims. */
@main def analyze(target: String, output: String, limit: Int = 80, fileRegex: String = ".*"): Unit = {
  require(limit > 0 && limit <= 500, "limit must be between 1 and 500")
  val root = java.nio.file.Path.of(target).toRealPath()
  val requested = java.nio.file.Path.of(output).toAbsolutePath.normalize()
  val destination = requested.getParent.toRealPath().resolve(requested.getFileName)
  require(!java.nio.file.Files.exists(destination), "output must not already exist")
  require(!destination.startsWith(root), "output must be outside target")
  // Parse separately with jssrc2cpg; importing an existing CPG avoids running builds.
  val graphFile = destination.getParent.resolve("cpg.bin")
  require(java.nio.file.Files.isRegularFile(graphFile), "expected cpg.bin beside output")
  importCpg(graphFile.toString)

  def short(value: String): String = value.replaceAll("[\\r\\n\\t]+", " ").take(180)
  def enclosing(node: AstNode): Method = node.astParent match {
    case method: Method => method
    case parent: AstNode => enclosing(parent)
  }
  def location(node: AstNode): String = s"${enclosing(node).filename}:${node.lineNumber.getOrElse(0)}"
  def owner(node: AstNode): String = enclosing(node).fullName
  def section(name: String, rows: List[ujson.Value]): ujson.Value =
    ujson.Obj("kind" -> name, "total" -> rows.size, "omitted" -> math.max(0, rows.size - limit),
      "items" -> ujson.Arr.from(rows.take(limit)))

  val methods = cpg.method.isExternal(false).l.filter(m => m.filename.matches(fileRegex)).sortBy(m => (m.filename, m.lineNumber.getOrElse(0), m.fullName))
  val calls = cpg.call.l.filter(c => c.method.filename.matches(fileRegex)).sortBy(c => (c.method.filename, c.lineNumber.getOrElse(0), c.id))
  val mutators = Set("push", "pop", "shift", "unshift", "splice", "sort", "reverse", "fill", "copyWithin", "set", "add", "delete", "clear")
  val assignments = Set("<operator>.assignment", "<operator>.assignmentPlus", "<operator>.assignmentMinus",
    "<operator>.assignmentMultiplication", "<operator>.assignmentDivision", "<operator>.assignmentModulo",
    "<operator>.assignmentAnd", "<operator>.assignmentOr", "<operator>.assignmentXor",
    "<operator>.postIncrement", "<operator>.preIncrement", "<operator>.postDecrement", "<operator>.preDecrement")
  val updates = calls.filter(c => assignments(c.name) || mutators(c.name)).map { c =>
    val lhs = c.argument.l.headOption
    val direct = assignments(c.name) && lhs.exists {
      case access: Call => Set("<operator>.fieldAccess", "<operator>.indexAccess", "<operator>.indirectIndexAccess")(access.name)
      case _ => false
    }
    ujson.Obj("location" -> location(c), "owner" -> owner(c), "operation" -> c.name,
      "category" -> (if (direct) "direct-field-or-index-update" else if (assignments(c.name)) "other-assignment" else "name-matched-mutator-candidate"),
      "subject" -> short(lhs.map(_.code).getOrElse("")),
      "expression" -> (if (assignments(c.name)) short(lhs.map(_.code).getOrElse("") + " " + c.name) else short(lhs.map(_.code).getOrElse("") + "." + c.name + "(…)")),
      "possiblyLowered" -> lhs.exists(_.code.startsWith("_tmp_")))
  }
  val edges = calls.filterNot(_.name.startsWith("<operator>")).map { c =>
    ujson.Obj("location" -> location(c), "caller" -> owner(c), "argumentCount" -> c.argument.size,
      "name" -> c.name, "methodFullName" -> c.methodFullName,
      "resolvedInternalCallees" -> ujson.Arr.from(c.callee.isExternal(false).fullName.l.distinct.sorted))
  }
  val nesting = methods.flatMap { m =>
    m.astParent match {
      case _: Method => Some(ujson.Obj("function" -> m.fullName, "location" -> s"${m.filename}:${m.lineNumber.getOrElse(0)}",
        "enclosing" -> m.astParent.asInstanceOf[Method].fullName))
      case _ => None
    }
  }
  val references = cpg.methodRef.l.filter(ref => enclosing(ref).filename.matches(fileRegex)).sortBy(_.id).map { ref =>
    ujson.Obj("location" -> location(ref), "enclosing" -> owner(ref), "referencedFunction" -> ref.methodFullName,
      "parentKind" -> ref.astParent.label,
      "parentCall" -> (ref.astParent match { case call: Call => call.name; case _ => "" }))
  }
  val result = ujson.Obj("schema" -> "joern-review/experimental-1", "target" -> root.toString,
    "claim" -> "CPG observations only; name matches and state contracts require source verification",
    "sections" -> ujson.Arr(
      section("functions", methods.map(m => ujson.Obj("function" -> m.fullName, "name" -> m.name,
        "location" -> s"${m.filename}:${m.lineNumber.getOrElse(0)}"))),
      section("state-update-candidates", updates.filterNot(_("category").str == "other-assignment").sortBy(_("possiblyLowered").bool)),
      section("related-local-assignments", updates.filter(_("category").str == "other-assignment")), section("calls", edges),
      section("lexically-nested-functions", nesting), section("function-references", references)))
  java.nio.file.Files.writeString(destination, ujson.write(result, indent = 2))
  println(s"Evidence written to $destination")
}
