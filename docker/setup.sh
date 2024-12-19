#!/bin/sh

# Wait for MinIO servers to be ready
sleep 20

# Setup aliases
mc alias set minio1 http://minio1:9000 minioadmin minioadmin
mc alias set minio2 http://minio2:9000 minioadmin minioadmin
mc alias set minio3 http://minio3:9000 minioadmin minioadmin

# Create buckets
for endpoint in minio1 minio2 minio3; do
    # Create bucket if it doesn't exist
    mc mb ${endpoint}/files --ignore-existing || true
    # Enable versioning
    mc version enable ${endpoint}/files
done

# Set bucket policy to allow replication
mc admin policy attach download minio1/files
mc admin policy attach download minio2/files
mc admin policy attach download minio3/files

# Configure replication from minio1 to minio2
mc replicate add minio1/files \
    --remote-bucket files \
    --remote-endpoint "http://minio2:9000" \
    --remote-access-key minioadmin \
    --remote-secret-key minioadmin \
    --sync

# Configure replication from minio1 to minio3
mc replicate add minio1/files \
    --remote-bucket files \
    --remote-endpoint "http://minio3:9000" \
    --remote-access-key minioadmin \
    --remote-secret-key minioadmin \
    --sync

# Configure replication from minio2 to minio1
mc replicate add minio2/files \
    --remote-bucket files \
    --remote-endpoint "http://minio1:9000" \
    --remote-access-key minioadmin \
    --remote-secret-key minioadmin \
    --sync

# Configure replication from minio2 to minio3
mc replicate add minio2/files \
    --remote-bucket files \
    --remote-endpoint "http://minio3:9000" \
    --remote-access-key minioadmin \
    --remote-secret-key minioadmin \
    --sync

# Configure replication from minio3 to minio1
mc replicate add minio3/files \
    --remote-bucket files \
    --remote-endpoint "http://minio1:9000" \
    --remote-access-key minioadmin \
    --remote-secret-key minioadmin \
    --sync

# Configure replication from minio3 to minio2
mc replicate add minio3/files \
    --remote-bucket files \
    --remote-endpoint "http://minio2:9000" \
    --remote-access-key minioadmin \
    --remote-secret-key minioadmin \
    --sync

# Verify replication setup
echo "Verifying replication configuration..."
mc replicate ls minio1/files

# Start continuous synchronization
mc mirror minio1/files minio2/files --watch --overwrite &
mc mirror minio1/files minio3/files --watch --overwrite &

mc mirror minio2/files minio1/files --watch --overwrite &
mc mirror minio2/files minio3/files --watch --overwrite &

mc mirror minio3/files minio1/files --watch --overwrite &
mc mirror minio3/files minio2/files --watch --overwrite &

echo "MinIO Setup Complete!"

# Keep container running to maintain sync
tail -f /dev/null
