'use client';

export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="bg-cmgreen-800 px-4 py-2 text-[12px] font-bold uppercase tracking-[0.14em] text-white hover:bg-cmgreen-900"
    >
      🖨 Imprimer / enregistrer en PDF
    </button>
  );
}
