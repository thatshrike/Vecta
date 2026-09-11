import pymupdf  # PyMuPDF

def extract(pdf_path, outfile):
    outfile.write(f"--- Extracting {pdf_path} ---\n")
    try:
        doc = pymupdf.open(pdf_path)
        for i, page in enumerate(doc):
            text = page.get_text()
            outfile.write(f"Page {i+1}:\n")
            if text.strip():
                outfile.write(text + "\n")
            else:
                outfile.write("<NO TEXT>\n")
            outfile.write("-" * 40 + "\n")
    except Exception as e:
        outfile.write(f"Error: {e}\n")

if __name__ == "__main__":
    with open("output_pymupdf.txt", "w", encoding="utf-8") as f:
        extract("tender_bhel.pdf", f)
        extract("bidder_compliant.pdf", f)
        extract("bidder_noncompliant.pdf", f)
        extract("bidder_ambigous.pdf", f)
