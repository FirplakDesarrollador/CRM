"use client";

import { useState, useEffect } from "react";
import { X, Download, FileSpreadsheet, Mail, Loader2, Eye, ExternalLink, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LocalCuenta, LocalOportunidad, LocalQuote, LocalQuoteItem } from "@/lib/db";
import { generateQuotePdfBlob, generateQuotePdf, calculatePdfTotals } from "@/lib/pdfGenerator";
import { generateQuoteExcel } from "@/lib/quoteExcelGenerator";

interface QuotePreviewModalProps {
    isOpen: boolean;
    onClose: () => void;
    quote: LocalQuote;
    account?: LocalCuenta;
    opportunity?: LocalOportunidad;
    quoteItems: LocalQuoteItem[];
    advisorName?: string;
    onSendEmail?: () => void;
}

export function QuotePreviewModal({
    isOpen,
    onClose,
    quote,
    account,
    opportunity,
    quoteItems,
    advisorName,
    onSendEmail,
}: QuotePreviewModalProps) {
    const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
    const [isDownloadingExcel, setIsDownloadingExcel] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!isOpen) {
            if (pdfBlobUrl) {
                URL.revokeObjectURL(pdfBlobUrl);
                setPdfBlobUrl(null);
            }
            return;
        }

        let isMounted = true;
        setIsLoading(true);
        setError(null);

        (async () => {
            try {
                const blob = await generateQuotePdfBlob(quote, quoteItems, account, opportunity, advisorName);
                if (!isMounted) return;
                const url = URL.createObjectURL(blob);
                setPdfBlobUrl(url);
            } catch (err: any) {
                console.error("Error al generar la previsualización del PDF:", err);
                if (isMounted) {
                    setError("No se pudo generar la vista previa del documento. Verifique los datos de la cotización.");
                }
            } finally {
                if (isMounted) setIsLoading(false);
            }
        })();

        return () => {
            isMounted = false;
        };
    }, [isOpen, quote, quoteItems, account, opportunity, advisorName]);

    if (!isOpen) return null;

    const totals = calculatePdfTotals(quoteItems, quote);
    const isUSD = quote.currency_id === "USD";
    const numFormatter = new Intl.NumberFormat("es-CO", {
        style: "currency",
        currency: isUSD ? "USD" : "COP",
        maximumFractionDigits: isUSD ? 2 : 0,
    });
    const formattedTotal = numFormatter.format(totals.granTotal);
    const formattedSubtotal = numFormatter.format(totals.descuentoTotal > 0 ? totals.subtotalBruto : totals.subtotal);
    const formattedDescuento = numFormatter.format(totals.descuentoTotal);

    const handleDownloadPdf = async () => {
        setIsDownloadingPdf(true);
        try {
            await generateQuotePdf(quote, quoteItems, account, opportunity, true, advisorName);
        } catch (err) {
            console.error("Error descargando PDF:", err);
        } finally {
            setIsDownloadingPdf(false);
        }
    };

    const handleDownloadExcel = async () => {
        setIsDownloadingExcel(true);
        try {
            await generateQuoteExcel(quote, quoteItems, account, opportunity, advisorName);
        } catch (err) {
            console.error("Error descargando Excel:", err);
        } finally {
            setIsDownloadingExcel(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
            <div className="bg-white rounded-2xl w-full max-w-5xl h-[92vh] max-h-[900px] flex flex-col shadow-2xl overflow-hidden border border-slate-200">
                {/* Header */}
                <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 border-b border-slate-200 bg-slate-50/80">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-100 text-blue-700 rounded-lg">
                            <Eye className="w-5 h-5" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h2 className="font-bold text-slate-800 text-base sm:text-lg">
                                    Previsualización de Cotización
                                </h2>
                                <span className="bg-slate-200 text-slate-700 text-xs px-2 py-0.5 rounded font-mono font-bold">
                                    {quote.numero_cotizacion || "Borrador"}
                                </span>
                            </div>
                            <p className="text-xs text-slate-500 truncate max-w-md">
                                {account?.nombre || "Sin cuenta vinculada"} • {opportunity?.nombre || "Oportunidad"}
                            </p>
                        </div>
                    </div>

                    <button
                        onClick={onClose}
                        className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
                        title="Cerrar vista previa"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Body / PDF Viewer */}
                <div className="flex-1 bg-slate-100 p-2 sm:p-4 overflow-hidden flex flex-col items-center justify-center relative">
                    {isLoading && (
                        <div className="flex flex-col items-center gap-3 text-slate-500">
                            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                            <p className="text-sm font-medium">Generando vista previa del documento...</p>
                        </div>
                    )}

                    {error && !isLoading && (
                        <div className="max-w-md bg-white p-6 rounded-xl border border-red-200 text-center shadow-sm space-y-3">
                            <AlertCircle className="w-10 h-10 text-red-500 mx-auto" />
                            <h3 className="font-bold text-slate-800">Error de Previsualización</h3>
                            <p className="text-xs text-slate-600">{error}</p>
                            <Button
                                variant="outline"
                                onClick={() => {
                                    setIsLoading(true);
                                    setError(null);
                                    generateQuotePdfBlob(quote, quoteItems, account, opportunity, advisorName)
                                        .then(blob => setPdfBlobUrl(URL.createObjectURL(blob)))
                                        .catch(() => setError("Reintento fallido."))
                                        .finally(() => setIsLoading(false));
                                }}
                            >
                                Reintentar
                            </Button>
                        </div>
                    )}

                    {pdfBlobUrl && !isLoading && !error && (
                        <div className="w-full h-full flex flex-col">
                            <iframe
                                src={pdfBlobUrl}
                                title={`Cotización ${quote.numero_cotizacion || "Borrador"}`}
                                className="w-full flex-1 rounded-lg border border-slate-300 shadow-sm bg-white"
                            />
                            <div className="mt-2 text-center">
                                <a
                                    href={pdfBlobUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 font-medium"
                                >
                                    <ExternalLink className="w-3.5 h-3.5" /> Abrir en ventana separada
                                </a>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer Toolbar */}
                <div className="px-4 sm:px-6 py-3 border-t border-slate-200 bg-white flex flex-col sm:flex-row items-center justify-between gap-3">
                    <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-start">
                        <div className="text-xs text-slate-500">
                            <span className="font-semibold text-slate-700">{quoteItems.length}</span> ítems
                        </div>
                        <div className="h-4 w-px bg-slate-200 hidden sm:block" />
                        <div className="text-xs flex flex-wrap items-center gap-2">
                            <span className="text-slate-500">Subtotal (sin IVA):</span>
                            <span className="font-medium text-slate-700">{formattedSubtotal}</span>
                            {totals.descuentoTotal > 0 && (
                                <span className="text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded font-medium text-[11px]">
                                    Desc: -{formattedDescuento}
                                </span>
                            )}
                            <span className="text-slate-300 hidden sm:inline">•</span>
                            <span className="text-slate-500">Total (con IVA):</span>{" "}
                            <span className="font-bold text-slate-900 text-sm">{formattedTotal}</span>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-end">
                        {onSendEmail && (
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                    onClose();
                                    onSendEmail();
                                }}
                                className="border-blue-200 text-blue-700 hover:bg-blue-50 text-xs sm:text-sm"
                            >
                                <Mail className="w-4 h-4 mr-1.5" />
                                Enviar por Correo
                            </Button>
                        )}

                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={handleDownloadExcel}
                            disabled={isDownloadingExcel}
                            className="border-emerald-300 text-emerald-700 hover:bg-emerald-50 text-xs sm:text-sm font-semibold"
                            title="Descargar cotización formateada en archivo Excel (.xlsx)"
                        >
                            {isDownloadingExcel ? (
                                <Loader2 className="w-4 h-4 animate-spin mr-1.5" />
                            ) : (
                                <FileSpreadsheet className="w-4 h-4 mr-1.5 text-emerald-600" />
                            )}
                            Descargar Excel
                        </Button>

                        <Button
                            type="button"
                            size="sm"
                            onClick={handleDownloadPdf}
                            disabled={isDownloadingPdf}
                            className="bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-semibold"
                            title="Descargar cotización oficial en PDF (formato F-V-29)"
                        >
                            {isDownloadingPdf ? (
                                <Loader2 className="w-4 h-4 animate-spin mr-1.5" />
                            ) : (
                                <Download className="w-4 h-4 mr-1.5" />
                            )}
                            Descargar PDF
                        </Button>

                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={onClose}
                            className="text-slate-500 hover:text-slate-700 text-xs sm:text-sm"
                        >
                            Cerrar
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
}

