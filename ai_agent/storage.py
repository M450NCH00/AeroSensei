"""MinIO (S3-compatible) object storage for generated PDF reports.

Reports are uploaded here so they persist across container restarts (backed by
the minio-data volume) instead of living on the agent's ephemeral filesystem.
The agent streams them back to the browser via GET /reports/<file>, so we never
need a public MinIO endpoint or presigned URLs.
"""
from __future__ import annotations

import logging

import boto3
from botocore.client import Config
from botocore.exceptions import ClientError

import config

log = logging.getLogger("storage")

_client = None


def _s3():
    global _client
    if _client is None:
        _client = boto3.client(
            "s3",
            endpoint_url=config.MINIO_ENDPOINT,
            aws_access_key_id=config.MINIO_ACCESS_KEY,
            aws_secret_access_key=config.MINIO_SECRET_KEY,
            region_name="us-east-1",
            # MinIO needs path-style addressing + SigV4.
            config=Config(signature_version="s3v4", s3={"addressing_style": "path"}),
        )
    return _client


def _ensure_bucket(s3, bucket: str) -> None:
    try:
        s3.head_bucket(Bucket=bucket)
    except ClientError:
        try:
            s3.create_bucket(Bucket=bucket)
        except ClientError as e:
            log.warning("could not create bucket %s: %s", bucket, e)


def upload_report(filename: str, data: bytes) -> None:
    """Store a PDF report under the reports bucket."""
    s3 = _s3()
    _ensure_bucket(s3, config.MINIO_REPORTS_BUCKET)
    s3.put_object(
        Bucket=config.MINIO_REPORTS_BUCKET,
        Key=filename,
        Body=data,
        ContentType="application/pdf",
    )


def get_report(filename: str) -> bytes | None:
    """Fetch a stored PDF report's bytes, or None if it doesn't exist."""
    s3 = _s3()
    try:
        obj = s3.get_object(Bucket=config.MINIO_REPORTS_BUCKET, Key=filename)
        return obj["Body"].read()
    except ClientError:
        return None


def list_backups() -> list[dict]:
    """List the historical-data backup objects, newest first.

    Returns [{key, name, size, last_modified}] for every object in the backups
    bucket. An empty list if the bucket is missing/empty.
    """
    s3 = _s3()
    try:
        paginator = s3.get_paginator("list_objects_v2")
        items: list[dict] = []
        for page in paginator.paginate(Bucket=config.MINIO_BACKUPS_BUCKET):
            for obj in page.get("Contents", []):
                items.append(
                    {
                        "key": obj["Key"],
                        "name": obj["Key"].rsplit("/", 1)[-1],
                        "size": obj["Size"],
                        "last_modified": obj["LastModified"].isoformat(),
                    }
                )
        items.sort(key=lambda o: o["last_modified"], reverse=True)
        return items
    except ClientError as e:
        log.warning("could not list backups bucket %s: %s", config.MINIO_BACKUPS_BUCKET, e)
        return []


def get_backup(key: str) -> bytes | None:
    """Fetch a backup object's bytes by key, or None if it doesn't exist."""
    s3 = _s3()
    try:
        obj = s3.get_object(Bucket=config.MINIO_BACKUPS_BUCKET, Key=key)
        return obj["Body"].read()
    except ClientError:
        return None
