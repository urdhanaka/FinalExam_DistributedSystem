#!/bin/bash

# Start MinIO server
minio server /bitnami/minio/data --address ":9000" --console-address ":9001" &

# Wait for MinIO to be ready
sleep 30

# Configure bucket replication (modify as per your use case)
mc alias set myminio http://localhost:9000 minio miniosecret
mc admin user add myminio replicator replicatorsecret
mc admin policy create myminio replication /bitnami/minio/policies/replication-policy.json
mc admin policy attach myminio replication --user replicator

# Apply bucket replication configuration
BUCKET_NAME="my-replicated-bucket"
mc mb myminio/$BUCKET_NAME
mc replicate add myminio/$BUCKET_NAME --replica-storage-class EC:4

# Keep the container running
tail -f /dev/null
