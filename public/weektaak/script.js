const translations = {
  kitchen: "Keuken",
  toilets: "Wc's",
  showers: "Douches",
  upstairs: "Badkamer boven",
};

const TURNOVER_DAY_OFFSET = -1; // Turnover is on Tuesday, so we look back 1 day

function addDays(date, days) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function isodate(date) {
  return date.toISOString().split("T")[0];
}

function humanShort(date) {
  return date.toLocaleDateString("nl-NL", { month: "short", day: "numeric" });
}

function weekNumberFromDate(datestring) {
  let date = new Date(datestring);
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + 3 - ((date.getDay() + 6) % 7));
  const week1 = new Date(date.getFullYear(), 0, 4);
  return (
    1 +
    Math.round(
      ((date.getTime() - week1.getTime()) / 86400000 -
        3 +
        ((week1.getDay() + 6) % 7)) /
        7,
    )
  );
}

function getMondayForDate(date) {
  const monday = new Date(date);
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  if (monday.getDay() !== 1) {
    console.error(`${monday.toLocaleDateString("nl-NL")} not a monday`);
  }
  return isodate(monday);
}

// Converts a Monday ISO date string to a URL param like "W20-2026"
function mondayToWeekParam(mondayIso) {
  return `W${weekNumberFromDate(mondayIso)}-${mondayIso.slice(0, 4)}`;
}

// Converts a URL param like "W20-2026" back to a Monday ISO date string
function weekParamToMonday(param) {
  const match = param.match(/^W(\d+)-(\d{4})$/);
  if (!match) return null;
  const [, week, year] = match;
  // Find the Monday of ISO week N: start from Jan 4 (always in week 1), go to the right week
  const jan4 = new Date(Number(year), 0, 4);
  const week1Monday = addDays(jan4, -((jan4.getDay() + 6) % 7));
  return isodate(addDays(week1Monday, (Number(week) - 1) * 7));
}

function getShownWeek() {
  const params = new URLSearchParams(window.location.search);
  const weekParam = params.get("w");
  if (weekParam) {
    const monday = weekParamToMonday(weekParam);
    if (monday) return monday;
  }
  return getMondayForDate(addDays(new Date(), TURNOVER_DAY_OFFSET));
}

function setContent(element, content) {
  document.getElementById(element).innerHTML = content;
}

function renderWeek(data, monday) {
  const weekList = data[monday];
  if (!weekList) {
    console.error(`No data for week starting ${monday}`);
    return;
  }

  const personalLink = (name) =>
    `<a href="persoonlijk.html#${name}">${name}</a>`;

  const kitchenNames = [weekList["kitchen-1"], weekList["kitchen-2"], weekList["kitchen-3"]]
    .map(personalLink)
    .join(", ");

  setContent("kitchen", kitchenNames);
  setContent("toilet", personalLink(weekList.toilets));
  setContent("shower", personalLink(weekList.showers));

  const upstairsSection = document.querySelector("section:has(#upstairs)");
  if (weekList.upstairs !== "") {
    setContent("upstairs", personalLink(weekList.upstairs));
    upstairsSection.style.display = "";
  } else {
    upstairsSection.style.display = "none";
  }

  const start = humanShort(addDays(new Date(monday), 1));
  const end = humanShort(addDays(new Date(monday), 7));
  setContent(
    "weeknumber",
    `<em>Week ${weekNumberFromDate(monday)}</em><br>${start} - ${end}`,
  );

  const nextMonday = isodate(addDays(new Date(monday), 7));
  const prevMonday = isodate(addDays(new Date(monday), -7));

  document.getElementById("nextWeek").dataset.date = nextMonday;
  document.getElementById("prevWeek").dataset.date = prevMonday;
}

function initIndexPage(data) {
  const navigate = (monday) => {
    const url = new URL(window.location.href);
    url.searchParams.set("w", mondayToWeekParam(monday));
    url.searchParams.delete("date"); // clean up any old-style date params
    history.pushState({ monday }, "", url);
    renderWeek(data, monday);
  };

  document.getElementById("nextWeek").addEventListener("click", (e) => {
    e.preventDefault();
    navigate(e.currentTarget.dataset.date);
  });

  document.getElementById("prevWeek").addEventListener("click", (e) => {
    e.preventDefault();
    navigate(e.currentTarget.dataset.date);
  });

  window.addEventListener("popstate", (e) => {
    const monday = e.state?.monday || getShownWeek();
    renderWeek(data, monday);
  });

  renderWeek(data, getShownWeek());
}

function fillPersonalTable(data, person) {
  const rows = Object.entries(data).reduce((acc, [weekStart, weekData]) => {
    const weekTasks = Object.entries(weekData)
      .filter(([_, name]) => name !== "" && name === person)
      .map(([task]) =>
        task.startsWith("kitchen") ? "keuken" : translations[task],
      );

    if (weekTasks.length > 0) {
      const weekNum = weekNumberFromDate(weekStart);
      const mondayDate = humanShort(new Date(weekStart));
      acc.push(`<tr>
        <td>${weekNum}</td>
        <td>${mondayDate}</td>
        <td>${weekTasks.join(" & ")}</td>
      </tr>`);
    }

    return acc;
  }, []);

  document.querySelector("#table tbody").innerHTML = rows.join("");
  document.querySelector("#icslink").setAttribute("href", `cal/${person.toLowerCase()}.ics`);
  history.replaceState(null, "", `#${person}`);
  document.title = `Weektaken ${person}`;
}

function initPersonalPage(data) {
  const names = [
    ...new Set(
      Object.values(data).flatMap((weekData) => Object.values(weekData)),
    ),
  ].filter(Boolean).sort();

  const select = document.getElementById("names");
  for (const name of names) {
    select.add(new Option(name));
  }

  const person = document.location.hash.replace("#", "");
  const matchingOption = Array.from(select.options).find((opt) => opt.value === person);
  if (matchingOption) {
    select.value = person;
    fillPersonalTable(data, person);
  }

  select.addEventListener("change", (e) => {
    fillPersonalTable(data, e.target.options[e.target.selectedIndex].text);
  });
}

(function () {
  const page = new URL(location.href).pathname.split("/").at(-1);
  const isIndex = !page || page === "" || page === "index.html";
  const isPersonal = page === "persoonlijk.html";

  if (!isIndex && !isPersonal) return;

  fetch("tasks.json")
    .then((response) => response.json())
    .then((data) => {
      if (isIndex) initIndexPage(data);
      else if (isPersonal) initPersonalPage(data);
    })
    .catch((error) => console.error("Error loading tasks:", error));
})();
