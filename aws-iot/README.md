# AWS IoT Core → InfluxDB

Cloud side of the AWS IoT migration. The ESP32 firmware in
[`../hardware/esp32-sketch-aws-iot.ino`](../hardware/esp32-sketch-aws-iot.ino)
publishes air-quality readings to AWS IoT Core over MQTT/TLS. An **IoT Rule**
forwards each message to a **Lambda** that writes it into InfluxDB using the
exact same `air_quality` measurement/tags/fields the on-prem sensors write —
so the existing InfluxDB alert task and the Spring Boot dashboards keep working
unchanged.

```
ESP32 --MQTT/TLS--> AWS IoT Core --Rule--> Lambda --HTTP--> InfluxDB
                                                              |
                                              (existing Flux alert task fires)
```

## Contents

| File | Purpose |
| --- | --- |
| `iot-rule.json` | IoT topic rule: SELECTs the telemetry payload and invokes the Lambda. |
| `lambda/handler.py` | Writes readings into InfluxDB (`air_quality` point). |
| `lambda/requirements.txt` | Lambda dependency (`influxdb-client`). |

## Deploy

### 1. Package & create the Lambda
```sh
cd lambda
pip install -r requirements.txt -t build
cp handler.py build/
(cd build && zip -r ../function.zip .)

aws lambda create-function \
  --function-name aerosensei-iot-to-influx \
  --runtime python3.12 \
  --handler handler.handler \
  --zip-file fileb://function.zip \
  --role arn:aws:iam::<ACCOUNT_ID>:role/<lambda-exec-role> \
  --timeout 15 \
  --environment "Variables={INFLUX_URL=https://<influx-host>:8086,INFLUX_TOKEN=<token>,INFLUX_ORG=my-org,INFLUX_BUCKET=sensors_data}"
```
Prefer storing `INFLUX_TOKEN` in AWS Secrets Manager / SSM Parameter Store and
reading it at runtime instead of a plain env var for production.

### 2. Create the IoT Rule
Edit `iot-rule.json`: replace `REPLACE_ACCOUNT_ID` and the region, then:
```sh
aws iot create-topic-rule \
  --rule-name aerosensei_telemetry_to_influx \
  --topic-rule-payload file://iot-rule.json
```

### 3. Allow IoT to invoke the Lambda
```sh
aws lambda add-permission \
  --function-name aerosensei-iot-to-influx \
  --statement-id iot-invoke \
  --action lambda:InvokeFunction \
  --principal iot.amazonaws.com \
  --source-arn arn:aws:iot:<region>:<ACCOUNT_ID>:rule/aerosensei_telemetry_to_influx
```

### 4. Networking note
If InfluxDB runs on-prem / in a private VPC, attach the Lambda to a VPC + subnet
with a route to it (NAT gateway for public InfluxDB, or VPC peering / Direct
Connect for private). A public InfluxDB endpoint needs no VPC config.

## Test
Publish a sample message from the AWS IoT MQTT test client to
`aerosensei/telemetry/<sensor-uuid>`:
```json
{
  "sensor_id": "00000000-0000-0000-0000-000000000000",
  "site_id": "1",
  "site_name": "VPBank Tower Hanoi",
  "pm1_0": 4.2, "pm2_5": 61.3, "pm4_0": 90.1, "pm10": 131.7, "nc0_5": 3100.0
}
```
Then confirm the point landed in InfluxDB (UI at :8086 or `influx query`) and,
if the values breach thresholds, that the Flux alert task fires within ~2 min.
Check the Lambda's CloudWatch logs for the `wrote N point(s)` line.
