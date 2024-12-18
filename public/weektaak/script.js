// sorry for the terrible code you are about to see
const translations = {
  kitchen: "Keuken",
  toilets: "Wc's",
  showers: "Douches",
  upstairs: "Badkamer boven",
};

function addDays(date, days) {
  var result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

Date.prototype.isodate = function () {
  return this.toISOString().split("T")[0];
};

Date.prototype.humanShort = function () {
  return this.toLocaleDateString("nl-NL", {
    month: "short",
    day: "numeric",
  });
};

function setContent(element, content) {
  document.getElementById(element).innerHTML = content;
}

function fillWeekList(weekList) {
  const personalLink = (name) =>
    `<a href="persoonlijk.html#${name}">${name}</a>`;

  const linkList = [
    weekList["kitchen-1"],
    weekList["kitchen-2"],
    weekList["kitchen-3"],
  ]
    .map(personalLink)
    .join(", ");

  setContent("kitchen", linkList);
  setContent("toilet", personalLink(weekList.toilets));
  setContent("shower", personalLink(weekList.showers));
  if (weekList.upstairs !== "") {
    setContent("upstairs", personalLink(weekList.upstairs));
  } else {
    document.querySelector('section:has(#upstairs)').remove()
  }

  // start on tuesday
  const start = addDays(new Date(weekList.weekStart), 1).humanShort();
  const end = addDays(new Date(weekList.weekStart), 7).humanShort();
  setContent(
    "weeknumber",
    `<em>Week ${weekNumberFromDate(weekList.weekStart)}</em><br>${start} - ${end}`,
  );

  const nextMonday = addDays(weekList.weekStart, 7);
  const nextURL = new URL(window.location.href);
  nextURL.searchParams.set("date", nextMonday.isodate());
  document.getElementById("nextWeek").setAttribute("href", nextURL.href);

  const prevMonday = addDays(weekList.weekStart, -7);
  const prevURL = new URL(window.location.href);
  prevURL.searchParams.set("date", prevMonday.isodate());
  document.getElementById("prevWeek").setAttribute("href", prevURL.href);
}

function weekNumberFromDate(datestring) {
  let date = new Date(datestring);
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + 3 - ((date.getDay() + 6) % 7));
  let week1 = new Date(date.getFullYear(), 0, 4);
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

function getShownWeek() {
  const params = new URLSearchParams(window.location.search);
  // otherwise use current date. Turnover is on Tuesday, thus -1
  let date = params.get("date") || addDays(new Date(), -1);

  monday = new Date(date);
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));

  // Monday is day 1 (and Sunday 0 lol)
  if (monday.getDay() != 1) {
    console.error(`${monday.toLocaleDateString("nl-NL")} not a monday`);
  }
  return monday.isodate();
}

function fillPersonalPage(data) {
  const names = [
    ...new Set(
      Object.values(data).flatMap((dateObj) => Object.values(dateObj)),
    ),
  ];

  var element = document.getElementById("names");
  for (let name of [...names].sort()) {
    element.add(new Option(name));
  }

  let person = document.location.hash.replace("#", "");
  const option = Array.from(element.options).find(
    (opt) => opt.value === person,
  );
  if (option) {
    element.value = person;
    fillPersonalTable(data, person);
  }
}

function fillPersonalTable(data, person) {
  const rows = Object.entries(data).reduce((acc, [weekStart, weekData]) => {
    const weekTasks = Object.entries(weekData)
      .filter(([_, name]) => name !== '' && name === person)
      .map(([task, _]) =>
        task.startsWith("kitchen") ? "keuken" : translations[task],
      );

    if (weekTasks.length > 0) {
      const weekNum = weekNumberFromDate(weekStart);
      const mondayDate = new Date(weekStart).humanShort();

      let cont = `<tr>
        <td>${weekNum}</td>
        <td>${mondayDate}</td>
        <td>${weekTasks.join(" & ")}</td>
      </tr>`;
      acc.push(cont);
    }

    return acc;
  }, []);

  document.querySelector("#table tbody").innerHTML = rows.join("");

  document
    .querySelector("#icslink")
    .setAttribute("href", `cal/${person.toLowerCase()}.ics`);

  document.location.hash = person;
  document.title = `Weektaken ${person}`;
}

(function () {
  fetch("tasks.json")
    .then((response) => response.json())
    .then((data) => {
      let page = new URL(location.href).pathname.split('/').at(-1);
      if (!page || page === "" || page === "index.html") {
        const monday = getShownWeek();
        let date = data[monday];
        date.weekStart = monday;
        fillWeekList(date);
      } else if (page === "persoonlijk.html") {
        fillPersonalPage(data);
        document
          .getElementById("names")
          .addEventListener("change", (change) => {
            var opt =
              change.srcElement.options[change.srcElement.selectedIndex];
            fillPersonalTable(data, opt.text);
          });
      }
    })
    .catch((error) => console.error("Error:", error));
})();
