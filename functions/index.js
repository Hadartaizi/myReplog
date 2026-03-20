const { onCall, HttpsError } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');

admin.initializeApp();

exports.deleteClientAccount = onCall(async (request) => {
  const callerUid = request.auth?.uid;
  const targetUid = request.data?.targetUid;

  if (!callerUid) {
    throw new HttpsError('unauthenticated', 'User must be signed in.');
  }

  if (!targetUid) {
    throw new HttpsError('invalid-argument', 'Missing targetUid.');
  }

  const db = admin.firestore();

  // בדיקת הרשאת אדמין
  const callerDoc = await db.collection('users').doc(callerUid).get();

  if (!callerDoc.exists) {
    throw new HttpsError('permission-denied', 'Caller user document not found.');
  }

  const callerData = callerDoc.data();
  if (callerData.role !== 'admin') {
    throw new HttpsError('permission-denied', 'Only admin can delete clients.');
  }

  // מחיקת workouts
  const workoutsSnap = await db
    .collection('workouts')
    .where('uid', '==', targetUid)
    .get();

  // מחיקת exercises
  const exercisesSnap = await db
    .collection('exercises')
    .where('uid', '==', targetUid)
    .get();

  const batch = db.batch();

  workoutsSnap.forEach((docSnap) => {
    batch.delete(docSnap.ref);
  });

  exercisesSnap.forEach((docSnap) => {
    batch.delete(docSnap.ref);
  });

  // מחיקת מסמך המשתמש מתוך users
  batch.delete(db.collection('users').doc(targetUid));

  await batch.commit();

  // מחיקת המשתמש מ-Firebase Authentication
  await admin.auth().deleteUser(targetUid);

  return {
    success: true,
    deletedUid: targetUid,
  };
});