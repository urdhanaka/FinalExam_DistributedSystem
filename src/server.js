const grpc = require("@grpc/grpc-js");
const protoLoader = require("@grpc/proto-loader");
const Minio = require("minio");
const path = require("path");

const packageDefinition = protoLoader.loadSync("protos/storage.proto", {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});

const storageProto = grpc.loadPackageDefinition(packageDefinition);

// Setup MinIO client
const minioClient = new Minio.Client({
  endPoint: process.env.MINIO_ENDPOINT || "localhost",
  port: parseInt(process.env.MINIO_PORT) || 9000,
  useSSL: false,
  accessKey: process.env.MINIO_ACCESS_KEY || "minioadmin",
  secretKey: process.env.MINIO_SECRET_KEY || "minioadmin",
});

const BUCKET_NAME = "files";

const uploadFile = (call, callback) => {
  let fileData = Buffer.alloc(0);
  let fileName = "";

  call.on("data", (chunk) => {
    fileName = chunk.fileName;
    fileData = Buffer.concat([fileData, chunk.fileData]);
  });

  call.on("end", async () => {
    try {
      await minioClient.putObject(BUCKET_NAME, fileName, fileData);
      callback(null, { message: `File ${fileName} uploaded successfully` });
    } catch (error) {
      console.error("Upload error:", error);
      callback(error);
    }
  });
};

const downloadFile = (call) => {
  const fileName = call.request.fileName;

  minioClient
    .getObject(BUCKET_NAME, fileName)
    .then((stream) => {
      stream.on("data", (chunk) => {
        call.write({ fileData: chunk });
      });
      stream.on("end", () => {
        call.end();
      });
    })
    .catch((error) => {
      console.error("Download error:", error);
      call.destroy(error);
    });
};

const getMetadata = async (call, callback) => {
  const fileName = call.request.fileName;

  try {
    const stat = await minioClient.statObject(BUCKET_NAME, fileName);
    callback(null, {
      fileName: fileName,
      uploadTime: stat.lastModified.toISOString(),
      version: stat.versionId || "1.0",
    });
  } catch (error) {
    callback(error);
  }
};

const deleteFile = async (call, callback) => {
  const fileName = call.request.fileName;

  try {
    await minioClient.removeObject(BUCKET_NAME, fileName);
    callback(null, {
      message: `${fileName} deleted successfully`
    });
  } catch (error) {
    callback(error);
  }
}

function startServer() {
  const server = new grpc.Server();
  server.addService(storageProto.FileStorage.FileStorage.service, {
    UploadFile: uploadFile,
    DownloadFile: downloadFile,
    DeleteFile: deleteFile,
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
      console.log(`Server running at http://0.0.0.0:${port}`);
    }
  );
}

startServer();
