# Base image
FROM docker.io/bitnami/minio:2024

# Set environment variables
ENV BITNAMI_DEBUG=true
ENV MINIO_ROOT_USER=minio
ENV MINIO_ROOT_PASSWORD=miniosecret
ENV MINIO_DISTRIBUTED_MODE_ENABLED=yes
ENV MINIO_STORAGE_CLASS_STANDARD=EC:4

# Add replication setup script

RUN mkdir -p .bin

COPY replication-setup.sh .bin/replication-setup.sh
# RUN chmod +x .bin/replication-setup.sh

# Entry point override to include replication setup
ENTRYPOINT ["/bin/bash", "-c", ".bin/replication-setup.sh"]
