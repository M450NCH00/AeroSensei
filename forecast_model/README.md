## To Extract Data from Open Meteo
```bash
cd script
python data_extract.py
```
Notes: You can adjust the variables in `constants.py` to get the desired data. Data extracted will be saved into `data/` by default. 

## To Train Forecast Model
```bash
cd script
python train.py
```
By default, the script train 5 models that forecast the pm2.5 values in a specific location for the next 1, 3, 6, 12, and 24 hours.

## Access to Trained Models and Extracted Data
Models and csv files are uploaded to the following HuggingFace Collection due to large file size:
```url
https://huggingface.co/collections/CLXYee/aerosense-forecasting-model
```
