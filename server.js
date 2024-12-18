const grpc = require("@grpc/grpc-js");
const protoLoader = require("@grpc/proto-loader");
const fs = require("fs");
const path = require("path");

const packageDefinition = protoLoader.loadSync("protos/storage.proto", {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});

const storageProto = grpc.loadPackageDefinition(packageDefinition);

// Implement the service methods
const uploadFile = (call, callback) => {
  let fileData = Buffer.alloc(0);
  let fileName = "";

  call.on("data", (chunk) => {
    fileName = chunk.fileName;
    fileData = Buffer.concat([fileData, chunk.fileData]);
  });

  call.on("end", () => {
    // Save the file
    fs.writeFileSync(path.join(__dirname, "uploads", fileName), fileData);
    callback(null, { message: `File ${fileName} uploaded successfully` });
  });

  call.on("error", (error) => {
    console.error("Error:", error);
    callback(error);
  });
};

const downloadFile = (call) => {
  const fileName = call.request.fileName;
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
  } catch (error) {
    call.destroy(error);
  }
};

const getMetadata = (call, callback) => {
  const fileName = call.request.fileName;
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
};

// Create and start the gRPC server
function startServer() {
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

// Create uploads directory if it doesn't exist
if (!fs.existsSync(path.join(__dirname, "uploads"))) {
  fs.mkdirSync(path.join(__dirname, "uploads"));
}

startServer();
