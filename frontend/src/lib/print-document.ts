/** Select one receipt for this print action; restore the normal page afterwards. */
export function printDocument(id: string): void {
  const target = document.getElementById(id);
  if (!target) return;
  document
    .querySelectorAll(".sh17-print-active")
    .forEach((element) => element.classList.remove("sh17-print-active"));
  target.classList.add("sh17-print-active");
  document.body.dataset.sh17Print = "true";
  const cleanup = () => {
    target.classList.remove("sh17-print-active");
    delete document.body.dataset.sh17Print;
  };
  window.addEventListener("afterprint", cleanup, { once: true });
  try {
    window.print();
  } catch (error) {
    cleanup();
    throw error;
  }
}
