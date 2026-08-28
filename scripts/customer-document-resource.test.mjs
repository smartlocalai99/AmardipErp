import assert from "node:assert/strict";
import test from "node:test";

const resourceModule = await import("../lib/customerDocumentResource.js").catch(() => ({}));

test("viewer and download reuse one fetched PDF object URL", async () => {
  assert.equal(typeof resourceModule.loadCustomerPdfResource, "function");
  let fetchCount = 0;
  let revoked = null;
  const blob = new Blob(["%PDF-test"], { type: "application/pdf" });

  const resource = await resourceModule.loadCustomerPdfResource({
    customerId: "lift-1",
    downloadName: "handing-over-letter-LIFT-1.pdf",
    fetchImpl: async () => {
      fetchCount += 1;
      return { ok: true, blob: async () => blob };
    },
    urlApi: {
      createObjectURL: (received) => received === blob ? "blob:handover-1" : "blob:wrong",
      revokeObjectURL: (url) => { revoked = url; },
    },
  });

  assert.equal(fetchCount, 1);
  assert.equal(resource.objectUrl, "blob:handover-1");
  assert.equal(resource.downloadName, "handing-over-letter-LIFT-1.pdf");
  resource.dispose();
  assert.equal(revoked, "blob:handover-1");
});

test("failed PDF responses expose a retryable message", async () => {
  await assert.rejects(
    () => resourceModule.loadCustomerPdfResource({
      customerId: "lift-2",
      downloadName: "letter.pdf",
      fetchImpl: async () => ({ ok: false, status: 500 }),
      urlApi: URL,
    }),
    /Unable to open this document/,
  );
});
