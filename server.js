const grpc = require("@grpc/grpc-js");
const protoLoader = require("@grpc/proto-loader");
const fs = require("fs");
const path = require("path");
const Minio = require("minio");

const packageDefinition = protoLoader.loadSync("protos/storage.proto", {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});

const storageProto = grpc.loadPackageDefinition(packageDefinition);

// Setup MinIO client dengan konfigurasi yang benar
const minioClient = new Minio.Client({
  endPoint: "localhost", // atau IP address MinIO server Anda
  port: 9000, // port default MinIO
  useSSL: false, // set true jika menggunakan HTTPS
  accessKey: "minioadmin", // default access key
  secretKey: "minioadmin", // default secret key
});

const BUCKET_NAME = "files";

// Fungsi untuk mengecek dan membuat bucket
async function ensureBucketExists() {
  try {
    const exists = await minioClient.bucketExists(BUCKET_NAME);
    if (!exists) {
      await minioClient.makeBucket(BUCKET_NAME, "us-east-1"); // tambahkan region
      console.log(`Bucket '${BUCKET_NAME}' created successfully`);
    } else {
      console.log(`Bucket '${BUCKET_NAME}' already exists`);
    }
  } catch (err) {
    console.error("Error ensuring bucket exists:", err);
    // Lanjutkan eksekusi meskipun ada error dengan MinIO
    console.log("Continuing with local storage only...");
  }
}

// Implement the service methods
const uploadFile = (call, callback) => {
  let fileData = Buffer.alloc(0);
  let fileName = "";

  call.on("data", (chunk) => {
    fileName = chunk.fileName;
    fileData = Buffer.concat([fileData, chunk.fileData]);
  });

  call.on("end", async () => {
    try {
      // Coba upload ke MinIO
      try {
        await minioClient.putObject(BUCKET_NAME, fileName, fileData);
        console.log(`File uploaded to MinIO: ${fileName}`);
      } catch (minioError) {
        console.error("MinIO upload failed:", minioError);
      }

      // Selalu simpan ke local storage sebagai backup
      fs.writeFileSync(path.join(__dirname, "uploads", fileName), fileData);
      console.log(`File saved locally: ${fileName}`);

      callback(null, { message: `File ${fileName} uploaded successfully` });
    } catch (error) {
      console.error("Upload error:", error);
      callback(error);
    }
  });

  call.on("error", (error) => {
    console.error("Error:", error);
    callback(error);
  });
};

const downloadFile = (call) => {
  const fileName = call.request.fileName;

  // Coba download dari MinIO terlebih dahulu
  minioClient
    .getObject(BUCKET_NAME, fileName)
    .then((stream) => {
      stream.on("data", (chunk) => {
        call.write({ fileData: chunk });
      });

      stream.on("end", () => {
        call.end();
      });

      stream.on("error", (error) => {
        // Jika MinIO gagal, gunakan local storage
        fallbackToLocalStorage();
      });
    })
    .catch(() => {
      // Jika MinIO gagal, gunakan local storage
      fallbackToLocalStorage();
    });

  function fallbackToLocalStorage() {
    try {
      const fileStream = fs.createReadStream(
        path.join(__dirname, "uploads", fileName)
      );
      fileStream.on("data", (chunk) => {
        call.write({ fileData: chunk });
      });
      fileStream.on("end", () => {
        call.end();
      });
      fileStream.on("error", (error) => {
        call.destroy(error);
      });
    } catch (error) {
      call.destroy(error);
    }
  }
};

const getMetadata = async (call, callback) => {
  const fileName = call.request.fileName;

  try {
    // Coba dapatkan metadata dari MinIO
    const stat = await minioClient.statObject(BUCKET_NAME, fileName);
    callback(null, {
      fileName: fileName,
      uploadTime: stat.lastModified.toISOString(),
      version: stat.versionId || "1.0",
    });
  } catch (minioError) {
    // Fallback ke local storage
    try {
      const stats = fs.statSync(path.join(__dirname, "uploads", fileName));
      callback(null, {
        fileName: fileName,
        uploadTime: stats.mtime.toISOString(),
        version: "1.0",
      });
    } catch (error) {
      callback(error);
    }
  }
};

// Create and start the gRPC server
async function startServer() {
  // Pastikan direktori uploads ada
  if (!fs.existsSync(path.join(__dirname, "uploads"))) {
    fs.mkdirSync(path.join(__dirname, "uploads"));
  }

  // Coba inisialisasi MinIO bucket
  await ensureBucketExists().catch(console.error);

  const server = new grpc.Server();
  server.addService(storageProto.FileStorage.FileStorage.service, {
    UploadFile: uploadFile,
    DownloadFile: downloadFile,
    GetMetadata: getMetadata,
  });

  server.bindAsync(
    "0.0.0.0:5000",
    grpc.ServerCredentials.createInsecure(),
    (error, port) => {
      if (error) {
        console.error(error);
        return;
      }
      server.start();
      console.log(`Server running at http://0.0.0.0:${port}`);
    }
  );
}

startServer().catch(console.error);
