const grpc = require("@grpc/grpc-js");
const protoLoader = require("@grpc/proto-loader");
const fs = require("fs");

const packageDefinition = protoLoader.loadSync("protos/storage.proto", {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});

// Load the proto package
const storagePkg = grpc.loadPackageDefinition(packageDefinition);
// Create client instance
const client = new storagePkg.FileStorage.FileStorage(
  "localhost:5000",
  grpc.credentials.createInsecure()
);

function uploadFile(filePath) {
  return new Promise((resolve, reject) => {
    const call = client.UploadFile((error, response) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(response);
    });

    const fileName = filePath.split("/").pop();
    const stream = fs.createReadStream(filePath);

    stream.on("data", (chunk) => {
      call.write({
        fileData: chunk,
        fileName: fileName,
      });
    });

    stream.on("end", () => {
      call.end();
    });

    stream.on("error", (err) => {
      reject(err);
    });
  });
}

function downloadFile(fileName) {
  return new Promise((resolve, reject) => {
    const call = client.DownloadFile({ fileName });
    const writeStream = fs.createWriteStream(`downloaded_${fileName}`);

    call.on("data", (chunk) => {
      writeStream.write(chunk.fileData);
    });

    call.on("end", () => {
      writeStream.end();
      console.log(`Downloaded ${fileName}`);
      resolve();
    });

    call.on("error", (error) => {
      reject(error);
    });
  });
}

function getMetadata(fileName) {
  return new Promise((resolve, reject) => {
    client.GetMetadata({ fileName }, (error, response) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(response);
    });
  });
}

// Example usage
async function main() {
  try {
    // Upload file
    console.log("Uploading file...");
    await uploadFile("test.txt");
    console.log("File uploaded successfully");

    // Download file
    console.log("Downloading file...");
    await downloadFile("test.txt");
    console.log("File downloaded successfully");

    // Get metadata
    console.log("Getting metadata...");
    const metadata = await getMetadata("test.txt");
    console.log("Metadata:", metadata);
  } catch (error) {
    console.error("Error:", error);
  }
}

main();
