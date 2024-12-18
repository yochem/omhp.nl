import base64
import csv
import json

from datetime import datetime
from pathlib import Path


def csv_to_json(csv_file_path, json_file_path):
    data = {}
    keys = (
        "kitchen-1",
        "kitchen-2",
        "kitchen-3",
        "toilets",
        "showers",
        "upstairs",
    )


    lines = base64.b32decode(Path(csv_file_path).read_text()).decode('utf-8').splitlines()
    csv_reader = csv.reader(lines)

    # skip header line
    next(csv_reader)

    for row in csv_reader:
        start, _, *tasks = row
        if not start:
            break
        start_date = datetime.strptime(start, "%d-%m-%Y").date().isoformat()
        data[start_date] = dict(zip(keys, tasks))

    Path(json_file_path).write_text(json.dumps(
        data,
        separators=(",", ":"),
    ))


if __name__ == "__main__":
    csv_file_path = "data"
    json_file_path = "public/tasks.json"
    csv_to_json(csv_file_path, json_file_path)
