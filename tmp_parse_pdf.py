import pdfplumber
import sys

def parse_pdf(filepath):
    with pdfplumber.open(filepath) as pdf:
        for i, page in enumerate(pdf.pages):
            print(f"--- PAGE {i+1} ---")
            print(page.extract_text())
            tables = page.extract_tables()
            if tables:
                print("--- TABLES ---")
                for j, table in enumerate(tables):
                    print(f"Table {j+1}:")
                    for row in table:
                        print(row)

if __name__ == "__main__":
    if len(sys.argv) > 1:
        parse_pdf(sys.argv[1])
