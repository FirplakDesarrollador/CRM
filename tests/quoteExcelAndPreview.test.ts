import { describe, expect, it } from "vitest";
import { buildQuotePdfDoc, generateQuotePdfBlob } from "@/lib/pdfGenerator";
import { buildQuoteExcelWorkbook } from "@/lib/quoteExcelGenerator";

describe("Previsualización de Cotización (PDF) y Exportación a Excel", () => {
    const mockQuote = {
        id: "quote-1",
        numero_cotizacion: "COT-2026-001",
        opportunity_id: "opp-1",
        status: "DRAFT",
        currency_id: "COP",
        created_at: "2026-11-06T10:00:00Z",
        terminos_pago: "30 Días",
        tipo_facturacion: "PARCIAL",
    };

    const mockAccount = {
        id: "acc-1",
        nombre: "CONSTRUCTORA BOLIVAR S.A.",
        nit: "900123456-7",
        telefono: "3001234567",
        email: "compras@bolivar.com",
        ciudad: "Medellín",
        direccion: "Cra 43A # 1-50",
    };

    const mockOpportunity = {
        id: "opp-1",
        nombre: "Proyecto Torres del Prado",
        account_id: "acc-1",
        owner_user_id: "user-1",
    };

    const mockItems = [
        {
            id: "item-1",
            producto_id: "prod-1",
            numero_articulo: "VHPT01-0005-000-0100",
            descripcion_linea: "HIDROMASAJE HONOLULU DERECHA 180X120",
            precio_unitario: 5000000,
            cantidad: 2,
            discount_pct: 10,
            subtotal: 9000000,
        },
        {
            id: "item-2",
            producto_id: "prod-2",
            numero_articulo: "LAV-001",
            descripcion_linea: "LAVAMANOS VESSEL MILAN",
            precio_unitario: 1000000,
            cantidad: 1,
            discount_pct: 0,
            subtotal: 1000000,
        },
    ];

    it("buildQuotePdfDoc genera una instancia de jsPDF con logo oficial y diseño corporativo", async () => {
        const doc = await buildQuotePdfDoc(mockQuote, mockItems, mockAccount, mockOpportunity, "Asesor Comercial");
        expect(doc).toBeDefined();
        expect(typeof doc.output).toBe("function");

        const pdfArrayBuffer = doc.output("arraybuffer");
        expect(pdfArrayBuffer.byteLength).toBeGreaterThan(50000); // El logo PNG en alta resolución y estilos garantizan un PDF completo

        // Verificar que contiene metadatos de página válidos
        const pages = doc.getNumberOfPages();
        expect(pages).toBeGreaterThanOrEqual(1);
    });

    it("generateQuotePdfBlob genera un Blob de tipo application/pdf", async () => {
        const blob = await generateQuotePdfBlob(mockQuote, mockItems, mockAccount, mockOpportunity, "Asesor Comercial");
        expect(blob).toBeDefined();
        expect(blob.type).toBe("application/pdf");
        expect(blob.size).toBeGreaterThan(0);
    });

    it("buildQuoteExcelWorkbook crea un libro Excel con cabeceras, ítems y totales consistentes", async () => {
        const workbook = await buildQuoteExcelWorkbook(mockQuote, mockItems, mockAccount, mockOpportunity, "Asesor Comercial");
        expect(workbook).toBeDefined();

        const worksheet = workbook.getWorksheet("Cotización");
        expect(worksheet).toBeDefined();

        // Verificar que contenga datos del cliente y cotización
        const contentStr: string[] = [];
        worksheet?.eachRow((row) => {
            row.eachCell((cell) => {
                if (cell.value) contentStr.push(String(cell.value));
            });
        });

        const fullText = contentStr.join(" ");
        expect(fullText).toContain("COT-2026-001");
        expect(fullText).toContain("CONSTRUCTORA BOLIVAR S.A.");
        expect(fullText).toContain("VHPT01-0005-000-0100");
        expect(fullText).toContain("LAV-001");

        // Subtotal esperado: 9.000.000 + 1.000.000 = 10.000.000
        // IVA esperado (19%): 1.900.000
        // Gran Total: 11.900.000
        expect(fullText).toContain("10000000");
        expect(fullText).toContain("1900000");
        expect(fullText).toContain("11900000");
    });

    it("buildQuoteExcelWorkbook maneja cotizaciones en USD sin IVA", async () => {
        const usdQuote = { ...mockQuote, currency_id: "USD" };
        const workbook = await buildQuoteExcelWorkbook(usdQuote, mockItems, mockAccount, mockOpportunity, "Asesor Export");
        const worksheet = workbook.getWorksheet("Cotización");

        const contentStr: string[] = [];
        worksheet?.eachRow((row) => {
            row.eachCell((cell) => {
                if (cell.value !== undefined && cell.value !== null) contentStr.push(String(cell.value));
            });
        });

        const fullText = contentStr.join(" ");
        expect(fullText).toContain("USD");
        // En USD el IVA debe ser 0
        expect(fullText).toContain("IVA (0%)");
    });
});

