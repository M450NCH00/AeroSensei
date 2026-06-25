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
Notes: Flag `--pm` and `--hr` to toggle the desired forecast pm value and hours ahead. `--pm` takes in integer values of 25 and 10, while `--hr` takes in integer values of desired hours ahead. <br>
Example:
```bash
python train.py --pm 25 --hr 1
```

## Running Forecast
1. In testing mode (Not connected to endpoint)
```bash
cd script
python test.py
```
2. EConnecting to endpoint
```bash
cd script
python main.py
```
