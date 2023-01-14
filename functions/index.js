const functions = require("firebase-functions");
const { Storage } = require("@google-cloud/storage");
const UUID = require("uuid-v4");
const express = require("express");
const formidable = require("formidable-serverless");
require("dotenv").config();

const app = express();
app.use(express.json({ limit: "50mb", extended: true }));
app.use(express.urlencoded({ extended: false, limit: "50mb" }));

var admin = require("firebase-admin");

// admin.initializeApp({
//   credential: admin.credential.cert({
//     projectId: process.env.PROJECT_ID,
//     privateKey: process.env.PRIVATE_KEY?.replace(/\\n/g, "\n"),
//     clientEmail: process.env.CLIENT_EMAIL,
//   }),
//   databaseURL: process.env.DATABASE_URL,
//   storageBucket: "gs://fir-upload-8156e.appspot.com",
// });

var serviceAccount = require("./admin.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const userRef = admin.firestore().collection("users");

const storage = new Storage({
  keyFilename: "admin.json",
});

app.post("/creatUser", async (req, res) => {
  const form = new formidable.IncomingForm({ multiples: true });

  try {
    form.parse(req, async (err, fields, files) => {
      let uuid = UUID();
      var downLoadPath =
        "https://firebasestorage.googleapis.com/v0/b/fir-upload-8156e.appspot.com/o/";

      const profileImage = files.profileImage;

      // url of the uploaded image
      let imageUrl;

      const docID = userRef.doc().id;

      if (err) {
        return res.status(400).json({
          message: "There was an error parsing the files",
          data: {},
          error: err,
        });
      }
      const bucket = storage.bucket("gs://fir-upload-8156e.appspot.com");

      if (profileImage.size == 0) {
        // do nothing
      } else {
        const imageResponse = await bucket.upload(profileImage.path, {
          destination: `users/${profileImage.name}`,
          resumable: true,
          metadata: {
            metadata: {
              firebaseStorageDownloadTokens: uuid,
            },
          },
        });
        // profile image url
        imageUrl =
          downLoadPath +
          encodeURIComponent(imageResponse[0].name) +
          "?alt=media&token=" +
          uuid;
      }
      // object to send to database
      const userModel = {
        id: docID,
        name: fields.name,
        email: fields.email,
        age: fields.age,
        profileImage: profileImage.size == 0 ? "" : imageUrl,
      };

      await userRef
        .doc(docID)
        .set(userModel, { merge: true })
        .then((value) => {
          // return response to users
          res.status(200).send({
            message: "user created successfully",
            data: userModel,
            error: {},
          });
        });
    });
  } catch (err) {
    res.send({
      message: "Something went wrong",
      data: {},
      error: err,
    });
  }
});

exports.helloWorld = functions.https.onRequest((request, response) => {
  // functions.logger.info("Hello logs!", {structuredData: true});
  response.send("Hello from Firebase!");
});

app.get("/getUsers", async (req, res, next) => {
  await userRef.get().then((value) => {
    const data = value.docs.map((doc) => doc.data());
    res.status(200).send({
      message: "Fetched all users",
      data: data,
    });
  });
});

app.get("/getUser/:id", async (req, res, next) => {
  await userRef
    .where("id", "==", req.params.id)
    .get()
    .then((value) => {
      const data = value.docs.map((doc) => doc.data());
      res.status(200).send({
        message: "User retrieved ",
        data: data,
      });
    });
});

exports.api = functions.https.onRequest(app);
