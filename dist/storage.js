let database;
export function openStorage() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("afterlight-v1", 1);
    request.onupgradeneeded = () =>
      request.result.createObjectStore("workspace");
    request.onsuccess = () => {
      database = request.result;
      database.onversionchange = () => database.close();
      resolve();
    };
    request.onerror = () => reject(request.error);
    request.onblocked = () =>
      reject(new Error("Close other Afterlight tabs to enable storage."));
  });
}
export function readProject() {
  return new Promise((resolve, reject) => {
    const tx = database.transaction("workspace", "readonly");
    const request = tx.objectStore("workspace").get("project");
    request.onsuccess = () => {
      const value = request.result;
      resolve(value?.project ? value : { project: value || null, revision: 0 });
    };
    request.onerror = () => reject(request.error);
  });
}
export function saveProject(project, expectedRevision) {
  return new Promise((resolve, reject) => {
    if (!database) {
      reject(
        new Error(
          "Browser storage is unavailable. Export a backup before closing.",
        ),
      );
      return;
    }
    const tx = database.transaction("workspace", "readwrite");
    const store = tx.objectStore("workspace");
    const read = store.get("project");
    let conflict = false;
    read.onsuccess = () => {
      const currentRevision = read.result?.revision || 0;
      if (currentRevision !== expectedRevision) {
        conflict = true;
        tx.abort();
        return;
      }
      store.put({ project, revision: currentRevision + 1 }, "project");
    };
    tx.oncomplete = () => resolve(expectedRevision + 1);
    tx.onabort = () =>
      reject(
        conflict
          ? Object.assign(
              new Error("This collection changed in another tab."),
              { name: "ConflictError" },
            )
          : tx.error || new Error("The project could not be saved."),
      );
    tx.onerror = () => reject(tx.error);
  });
}
