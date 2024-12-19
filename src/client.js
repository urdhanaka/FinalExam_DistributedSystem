const grpc = require("@grpc/grpc-js");
const protoLoader = require("@grpc/proto-loader");
const fs = require("fs");
const path = require("path");

// Load protobuf
const packageDefinition = protoLoader.loadSync(
  path.join(__dirname, "../protos/storage.proto"),
  {
    keepCase: true,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true,
  }
);

const storageProto = grpc.loadPackageDefinition(packageDefinition);

// Create gRPC client
const client = new storageProto.FileStorage.FileStorage(
  "localhost:5000",
  grpc.credentials.createInsecure()
);

// Upload file function
async function uploadFile(filePath) {
  return new Promise((resolve, reject) => {
    const call = client.UploadFile((error, response) => {
      if (error) {
        console.error("Upload error:", error);
        reject(error);
        return;
      }
      resolve(response);
    });

    // Get file name from path
    const fileName = path.basename(filePath);

    // Create read stream
    const stream = fs.createReadStream(filePath);

    stream.on("data", (chunk) => {
      call.write({
        fileName: fileName,
        fileData: chunk,
      });
    });

    stream.on("end", () => {
      call.end();
    });

    stream.on("error", (error) => {
      console.error("Read stream error:", error);
      call.destroy(error);
      reject(error);
    });
  });
}

// Download file function
async function downloadFile(fileName) {
  return new Promise((resolve, reject) => {
    // Create write stream
    const writeStream = fs.createWriteStream(`downloaded_${fileName}`);

    // Make download request
    const call = client.DownloadFile({ fileName });

    call.on("data", (chunk) => {
      writeStream.write(chunk.fileData);
    });

    call.on("end", () => {
      writeStream.end();
      console.log(`Downloaded ${fileName}`);
      resolve();
    });

    call.on("error", (error) => {
      console.error("Download error:", error);
      writeStream.end();
      reject(error);
    });
  });
}

// Get metadata function
async function getMetadata(fileName) {
  return new Promise((resolve, reject) => {
    client.GetMetadata({ fileName }, (error, response) => {
      if (error) {
        console.error("Metadata error:", error);
        reject(error);
        return;
      }
      resolve(response);
    });
  });
}

async function deleteFile(fileName) {
  return new Promise((resolve, reject) => {
    client.DeleteFile({ fileName }, (error, response) => {
      if (error) {
        console.error("Delete file error: ", error);
        reject(error);
        return;
      }

      resolve(response);
    })
  });
}

// Command line interface
async function main() {
  const command = process.argv[2];
  const filePath = process.argv[3];

  if (!command || !filePath) {
    console.log("Usage:");
    console.log("  Upload:   node client.js upload <filePath>");
    console.log("  Download: node client.js download <fileName>");
    console.log("  Metadata: node client.js metadata <fileName>");
    console.log("  Delete:   node client.js delete <fileName>");
    process.exit(1);
  }

  try {
    switch (command.toLowerCase()) {
      case "upload":
        if (!fs.existsSync(filePath)) {
          console.error(`File ${filePath} does not exist`);
          process.exit(1);
        }
        console.log(`Uploading ${filePath}...`);
        const uploadResponse = await uploadFile(filePath);
        console.log("Upload response:", uploadResponse);
        break;

      case "download":
        console.log(`Downloading ${filePath}...`);
        await downloadFile(filePath);
        console.log(`File downloaded as downloaded_${filePath}`);
        break;

      case "metadata":
        console.log(`Getting metadata for ${filePath}...`);
        const metadata = await getMetadata(filePath);
        console.log("Metadata:", metadata);
        break;

      case "delete":
        console.log(`Deleting file ${filePath}`);
        const res = await deleteFile(filePath);
        console.log(res);
        break;

      default:
        console.log("Invalid command. Use 'upload', 'download', 'metadata', or 'delete'");
        process.exit(1);
    }
  } catch (error) {
    console.error("Operation failed:", error.message);
    process.exit(1);
  }
}

// Add test functions
async function runTests() {
  try {
    // Test file creation
    const testFileName = "test.txt";
    const testContent = "Hello, this is a test file!";
    fs.writeFileSync(testFileName, testContent);

    // Test upload
    console.log("\n=== Testing Upload ===");
    const uploadResponse = await uploadFile(testFileName);
    console.log("Upload response:", uploadResponse);

    // Test metadata
    console.log("\n=== Testing Metadata ===");
    const metadata = await getMetadata(testFileName);
    console.log("Metadata:", metadata);

    // Test download
    console.log("\n=== Testing Download ===");
    await downloadFile(testFileName);

    // Verify downloaded content
    const downloadedContent = fs.readFileSync(
      `downloaded_${testFileName}`,
      "utf8"
    );
    console.log("Downloaded content:", downloadedContent);
    console.log("Original content:", testContent);
    console.log("Content match:", downloadedContent === testContent);

    // Cleanup
    fs.unlinkSync(testFileName);
    fs.unlinkSync(`downloaded_${testFileName}`);

    console.log("\n=== All tests completed successfully ===");
  } catch (error) {
    console.error("Test failed:", error);
  }
}

// Check if running tests
if (process.argv[2] === "--test") {
  runTests();
} else {
  main();
}

// Export functions for external use
module.exports = {
  uploadFile,
  downloadFile,
  getMetadata,
  deleteFile,
  runTests,
};
