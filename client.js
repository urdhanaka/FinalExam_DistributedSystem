const FILE_STORAGE_PROTO_PATH = __dirname + "/protos/filestorage.proto"

const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const fs = require('fs');

const packageDefinition = protoLoader.loadSync(FILE_STORAGE_PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true
});
const fileStorageProto = grpc.loadPackageDefinition(packageDefinition).filestorage
const client = new fileStorageProto.FileStorage('localhost:5000', grpc.credentials.createInsecure());

function runUploadFile(fileName) {
  const call = client.UploadFile((err, response) => {
    if (err) {
      console.error(err);
    } else {
    }
  });

  const fileFullPath = __dirname + `/${fileName}`;
  const stream = fs.createReadStream(fileFullPath);

  stream.on('data', (chunk) => call.write(chunk));

}

function main() {
  const call = client.UploadFile((err, response) => {
    if (err) {
      console.error(err);
    } else {
      console.log(response.Message)
    }
  });

  const chunks = ["Hello", "World!", "asdasd", "lafiqwfoi", "asdasqwopjqwporh", "opfaspofiassoapfiop"];
  chunks.forEach((chunk, _) => {
    console.log("Sending message: ", chunk);
    call.write({ FileData: chunk })
  });

  call.end();
}

main();
