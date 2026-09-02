export async function loadCustomerPdfResource({
  customerId,
  downloadName,
  documentType = "handing-over",
  fetchImpl = fetch,
  urlApi = URL,
}) {
  const response = await fetchImpl(
    `/api/customer/documents/${encodeURIComponent(documentType)}/${encodeURIComponent(customerId)}`,
    { cache: "no-store" },
  );

  if (!response.ok) throw new Error("Unable to open this document. Please try again.");
  const blob = await response.blob();
  const objectUrl = urlApi.createObjectURL(blob);
  let disposed = false;

  return {
    objectUrl,
    downloadName,
    blob,
    dispose() {
      if (disposed) return;
      disposed = true;
      urlApi.revokeObjectURL(objectUrl);
    },
  };
}
