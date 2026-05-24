# URL to Text and Index

## Download a URL as text

Using `lynx`:

```bash
sudo apt install lynx
```

```bash
mkdir -p texts

lynx -dump "https://example.com/article" > texts/article.txt
```

---

## Alternative with pandoc

```bash
sudo apt install pandoc
```

```bash
mkdir -p texts

pandoc "https://example.com/article" -t plain -o texts/article.txt
```

---

## Index the text document

```bash
pnpm run start index texts/article.txt \
  --metadata '{"fileName":"texts/article.txt","sourceUrl":"https://example.com/article"}'
```

---

## Search indexed documents

```bash
pnpm run start search "what was the article about?" --limit 1
```