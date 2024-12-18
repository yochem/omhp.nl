"""
Personal .ics calendars for the cleaning schedule at OMHP.

Currently, these generated calendar files are hosted at
omhp.nl/weektaak/cal/{}.ics, where {} is a placeholder for every tenants name.
"""

import base64
import os
import dataclasses
import datetime as dt
from pathlib import Path
from typing import Iterator
from textwrap import dedent

import ics


Pathable = str | os.PathLike[str]


@dataclasses.dataclass
class WeekCleaning:
    """
    One week of cleaning.

    Currently has three people for the kitchen, one for the toilets, one
    for the showers, and one for the bathroom upstairs.
    """

    week_start: dt.datetime
    kitchen: list[str]
    toilets: str
    showers: str
    upstairs: str

    def cleaners(self) -> list[str]:
        """Return a list of all names doing the cleaning of this week."""
        return self.kitchen + [self.toilets, self.showers, self.upstairs]

    def __contains__(self, person: str) -> bool:
        """Return if a person's name is in the schedule for this week."""
        return person in self.cleaners()

    def __iter__(self) -> Iterator[str]:
        """Iterate over the persons their name in this week's cleaning."""
        for cleaner in self.cleaners():
            yield cleaner

    def jobname(self, name: str) -> str:
        """Given a person's name, return the job description in Dutch."""
        if name in self.kitchen:
            return "Keuken"
        if name == self.toilets:
            return "Wc's"
        if name == self.showers:
            return "Douches"
        if name == self.upstairs:
            return "Boven"

        raise ValueError("name not in cleaning schedule")

    def __str__(self) -> str:
        """Return string representation of this week's cleaning."""
        schedule = dedent(f"""
            Keuken 🍳
            - {self.kitchen[0]}
            - {self.kitchen[1]}
            - {self.kitchen[2]}

            Wc's 🚽
            - {self.toilets}

            Douches 🚿
            - {self.showers}""")

        if self.upstairs != '':
            schedule += dedent(f"""

                Badkamer boven 🔝
                - {self.upstairs}""")

        schedule += dedent(f"""

            Zie https://yochem.nl/weektaak/ voor het hele schema""")

        return schedule

Schedule = list[WeekCleaning]


def csv2schedule(csv_file: Pathable) -> Schedule:
    """
    Convert csv-formatted schedule to a list of WeekCleaning objects.

    Args:
        csv_file: Path to csv-file.

    Returns:
        A schedule (list of WeekCleaning objects).

    Example:
        csv-file content:
            01-01-2023,08-01,2023,Abdula,Bob,Chiara,Darkan,Eloise,Frank

        Becomes:
            [WeekCleaning(
                week_start=datetime(2023, 1, 1),
                kitchen=['Abdula', 'Bob', 'Chiara'],
                toilets='Darkan',
                showers='Eloise',
                upstairs='Frank'
            )]
    """
    data_path = Path(csv_file)
    lines = base64.b32decode(data_path.read_text()).decode('utf-8').splitlines()

    # split and remove lines with empty fields
    weeks = [str(line).split(",") for line in lines[1:]]

    schedule = []

    for begin, _, *kitchen, toilets, showers, upstairs in weeks:
        if not begin:
            break
        begin_date = dt.datetime.strptime(begin, "%d-%m-%Y")
        schedule.append(WeekCleaning(begin_date, kitchen, toilets, showers, upstairs))

    return schedule


def person_index(schedule: Schedule) -> dict[str, Schedule]:
    """
    Create a personal schedule for every person on the schedule.

    This function creates an index for each person on the schedule, mapping
    their name to their personal schedule. This is done because
    `create_calendar()` requires a personal schedule in order to make the
    personal .ics-files.

    Args:
        schedule: The overall schedule for cleaning.

    Returns:
        A mapping of person and their personal schedule.
    """
    index: dict[str, Schedule] = {}

    for week in schedule:
        for person in week:
            index[person] = index.get(person, []) + [week]

    return index


def format_filename_template(template_path: Pathable, name: str) -> Path:
    """
    Construct personal filename by inserting the name in the template_path.

    Args:
        template_path: The path for the personal ics-file. Must include {} as
            placeholder for the `name`.
        name: Person's name.

    Returns:
        The formatted filename path.

    Raises:
        ValueError: if `template_path` does not include a format specifier.

    Example:
        >>> format_filename_template('calendars/{}-personal.ics', 'Yochem')
        Path('calendars/yochem-personal.ics')
    """
    formatted_filename = Path(str(template_path).format(name.lower()))
    if formatted_filename == Path(template_path):
        raise ValueError(
            f"filename {template_path} is not a format-string (include `{{}}`)"
        )
    return formatted_filename


def create_calendar(
    person: str, personal_schedule: Schedule, filename: Pathable = "{}.ics"
) -> None:
    """
    Create a calendar (ics-format) for given person with their personal schedule.

    Writes the file to disk at location given by `filename`.

    Args:
        person: Name of person in schedule.
        personal_schedule: Schedule of that person. Each week should include
            the person.
        filename: A path with a format specifier for inserting the name.

    Returns:
        None
    """
    cal = ics.Calendar()

    for week in personal_schedule:
        event = ics.Event(
            name=f"Weektaak: {week.jobname(person)}",
            begin=week.week_start.isoformat(sep=" "),
            duration=dt.timedelta(days=6),
            transparent=True,
            description=str(week),
            created=dt.datetime.now(),
            last_modified=dt.datetime.now(),
        )
        event.make_all_day()
        cal.events.add(event)

    personal_filename = format_filename_template(filename, person)
    personal_filename.parent.mkdir(exist_ok=True, parents=True)
    personal_filename.write_text(cal.serialize())


def admin_calendar(schedule: Schedule, filename: Pathable = "admin.ics") -> None:
    """
    Create a calendar (ics-format) for the admin.

    Writes the file to disk at location given by `filename`.

    Args:
        schedule: Schedule for everyone.
        filename: A path with a format specifier for inserting the name.

    Returns:
        None
    """
    cal = ics.Calendar()

    for week in schedule:
        event = ics.Event(
            name="Weektaak",
            begin=week.week_start.isoformat(sep=" "),
            duration=dt.timedelta(days=6),
            transparent=True,
            description=str(week),
            created=dt.datetime.now(),
            last_modified=dt.datetime.now(),
        )
        event.make_all_day()
        cal.events.add(event)

    Path(filename).write_text(cal.serialize())


def cleanup(ics_dir: Pathable) -> None:
    """
    Remove all files ending with .ics in given directory.

    Does nothing when directory does not exist.
    """
    target_dir = Path(ics_dir)

    if not target_dir.is_dir():
        print(f"nothing to cleanup: {target_dir} is not a directory")
        return

    for file in target_dir.glob("*.ics"):
        file.unlink()


def cli(cfg: dict[str, str]) -> None:
    """
    Command-line interface for converting csv data to a directory of ics-files.

    This function first removes all ics-files in the given output directory and
    then fills it with all personal calendars.
    """
    ics_filename_format = Path(cfg["ics_filename_format"])

    output_dir = ics_filename_format.parent
    cleanup(output_dir)

    schedule = csv2schedule(cfg["data_path"])
    index = person_index(schedule)

    for person, personal_schedule in index.items():
        create_calendar(person, personal_schedule, filename=ics_filename_format)

    if admin_path := cfg.get("admin"):
        admin_calendar(schedule, admin_path)


if __name__ == "__main__":
    config = {
        "ics_filename_format": "public/cal/{}.ics",
        "data_path": "data",
        "admin": "public/cal/admin.ics",
    }
    cli(config)
