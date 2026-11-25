import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { SaleDTO } from '../types/inventory.ts';
import { formatCurrency } from './inventoryMath.ts';

function escapeCsvCell(value: string | number): string {
  const str = String(value ?? '');
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function exportToCsv(
  filename: string,
  headers: string[],
  rows: Array<Array<string | number>>
): void {
  const csvLines = [
    headers.map(escapeCsvCell).join(','),
    ...rows.map((row) => row.map(escapeCsvCell).join(',')),
  ];
  const blob = new Blob([csvLines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function exportSaleInvoicePdf(sale: SaleDTO): void {
  const doc = new jsPDF({ unit: 'pt', format: 'letter' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.setTextColor(15, 23, 42);
  doc.text('StockMaster', 44, 52);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(100, 116, 139);
  doc.text('Commercial Inventory & Supply Operations', 44, 68);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(37, 99, 235);
  doc.text('INVOICE', 568, 52, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text(`Invoice #: ${sale.invoiceNumber}`, 568, 70, { align: 'right' });
  doc.text(`Date: ${new Date(sale.createdAt).toLocaleDateString('en-US')}`, 568, 85, { align: 'right' });
  doc.text(`Status: ${sale.status}`, 568, 100, { align: 'right' });

  doc.setDrawColor(226, 232, 240);
  doc.line(44, 118, 568, 118);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(71, 85, 105);
  doc.text('Bill To', 44, 140);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text(sale.customerName, 44, 156);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(71, 85, 105);
  let yCursor = 171;
  if (sale.customerEmail) {
    doc.text(sale.customerEmail, 44, yCursor);
    yCursor += 14;
  }
  if (sale.customerPhone) {
    doc.text(sale.customerPhone, 44, yCursor);
    yCursor += 14;
  }
  doc.text(`Payment Method: ${sale.paymentMethod}`, 44, yCursor);

  autoTable(doc, {
    startY: Math.max(yCursor + 24, 210),
    head: [['SKU', 'Item Description', 'Qty', 'Unit Price', 'Line Total']],
    body: sale.items.map((item) => [
      item.sku,
      item.productName,
      String(item.quantity),
      formatCurrency(item.unitPrice),
      formatCurrency(item.lineTotal),
    ]),
    styles: {
      fontSize: 9.5,
      cellPadding: 8,
      textColor: [15, 23, 42],
    },
    headStyles: {
      fillColor: [15, 23, 42],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
    },
    columnStyles: {
      2: { halign: 'right' },
      3: { halign: 'right' },
      4: { halign: 'right' },
    },
    margin: { left: 44, right: 44 },
  });

  const finalY = ((doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY || 360) + 24;

  doc.setFontSize(10);
  doc.setTextColor(71, 85, 105);
  doc.text('Subtotal:', 420, finalY);
  doc.setTextColor(15, 23, 42);
  doc.text(formatCurrency(sale.subtotal), 568, finalY, { align: 'right' });

  doc.setTextColor(71, 85, 105);
  doc.text(`Tax (${(sale.taxRate * 100).toFixed(1)}%):`, 420, finalY + 18);
  doc.setTextColor(15, 23, 42);
  doc.text(formatCurrency(sale.taxAmount), 568, finalY + 18, { align: 'right' });

  doc.setDrawColor(203, 213, 225);
  doc.line(420, finalY + 28, 568, finalY + 28);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('Total:', 420, finalY + 46);
  doc.text(formatCurrency(sale.total), 568, finalY + 46, { align: 'right' });

  if (sale.notes) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text(`Notes: ${sale.notes}`, 44, finalY + 80);
  }

  doc.save(`${sale.invoiceNumber}.pdf`);
}

export function exportReportPdf(
  filename: string,
  title: string,
  subtitle: string,
  headers: string[],
  rows: Array<Array<string | number>>
): void {
  const doc = new jsPDF({ unit: 'pt', format: 'letter', orientation: 'landscape' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(15, 23, 42);
  doc.text(`StockMaster — ${title}`, 40, 46);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(100, 116, 139);
  doc.text(`${subtitle} · Generated ${new Date().toLocaleString('en-US')}`, 40, 64);

  autoTable(doc, {
    startY: 84,
    head: [headers],
    body: rows.map((r) => r.map((cell) => String(cell ?? ''))),
    styles: {
      fontSize: 8.5,
      cellPadding: 6,
      textColor: [15, 23, 42],
    },
    headStyles: {
      fillColor: [15, 23, 42],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
    },
    margin: { left: 40, right: 40 },
  });

  doc.save(filename.endsWith('.pdf') ? filename : `${filename}.pdf`);
}
