# PDF to Text and Index

## Install pdftotext

Ubuntu / Debian / WSL:

```bash
sudo apt install poppler-utils
```

---

## Convert a PDF to text

```bash
pdftotext book.pdf book.txt
```

Optional:

```bash
pdftotext -layout book.pdf book.txt
```

---

## Convert a folder of PDFs

```bash
mkdir -p texts

for f in books/*.pdf; do
  base=$(basename "$f" .pdf)
  pdftotext "$f" "texts/$base.txt"
done
```

---

## Index a text document

```bash
pnpm run start index texts/book.txt \
  --metadata '{"fileName":"texts/book.txt"}'
```

---

## Search indexed documents

```bash
pnpm run start search "how to design an ML pipeline?" --limit 1
```