// Production adapters (T-043): Firestore document store + Firebase Storage.
// On Cloud Run, firebase-admin initializes from the attached service account
// (Application Default Credentials); no key file is ever read from the repo.
async function appInstance() {
  const { initializeApp, getApps, getApp } = await import('firebase-admin/app');
  return getApps().length ? getApp() : initializeApp();
}

export async function createFirestoreStore() {
  const [{ getFirestore }, app] = await Promise.all([import('firebase-admin/firestore'), appInstance()]);
  const db = getFirestore(app);
  return {
    async put(name, id, data) {
      await db.collection(name).doc(id).set({ ...data, id });
      return id;
    },
    async get(name, id) {
      const snap = await db.collection(name).doc(id).get();
      return snap.exists ? { ...snap.data(), id: snap.id } : null;
    },
    async delete(name, id) {
      await db.collection(name).doc(id).delete();
    },
    async list(name) {
      const snap = await db.collection(name).get();
      return snap.docs.map((d) => ({ ...d.data(), id: d.id }));
    },
    async query(name, field, value) {
      const snap = await db.collection(name).where(field, '==', value).get();
      return snap.docs.map((d) => ({ ...d.data(), id: d.id }));
    },
  };
}

export async function createFirebaseStorage(bucketName) {
  const [{ getStorage }, app] = await Promise.all([import('firebase-admin/storage'), appInstance()]);
  const bucket = getStorage(app).bucket(bucketName);
  return {
    async put(key, buffer) {
      await bucket.file(key).save(buffer);
      return key;
    },
    async get(key) {
      const [buf] = await bucket.file(key).download();
      return buf;
    },
  };
}
