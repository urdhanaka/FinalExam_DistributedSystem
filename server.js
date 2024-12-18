require('dotenv').config();

const FILE_STORAGE_PROTO_PATH = __dirname + "/protos/filestorage.proto"

const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const Minio = require('minio');

// const fs = require('fs');
// const path = require('path');
//

const packageDefinition = protoLoader.loadSync(FILE_STORAGE_PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true
});
const fileStorageProto = grpc.loadPackageDefinition(packageDefinition).filestorage;
const fileStorageService = fileStorageProto.FileStorage.service

// NOTE: add more node
const minioClients = [
  new Minio.Client({
    endPoint: process.env.MINIO_ENDPOINT_1.split(':')[0],
    port: parseInt(process.env.MINIO_ENDPOINT_1.split(':')[1]),
    accessKey: process.env.MINIO_ACCESS_KEY,
    secretKey: process.env.MINIO_SECRET_KEY,
    useSSL: false,
  })
];

async function UploadFile(call, callback) {
  const chunks = [];

  // data is streamed
  call.on('data', (chunk) => {
    console.log("Received data: ", chunk.FileData)
    chunks.push(chunk.FileData)
  });

  // all data is received by server
  call.on('end', async () => {
    console.log(`Data received, data: `, chunks);

    callback(null, { message: `File uploaded successfully` });
  });

  // error
  call.on('error', (err) => {
    console.error("Error: ", err)
  })
}

function main() {
  const server = new grpc.Server();

  server.addService(fileStorageService, { UploadFile });
  server.bindAsync('0.0.0.0:5000', grpc.ServerCredentials.createInsecure(), () => {
    console.log('gRPC server running on port 5000');
  })
}

main();
