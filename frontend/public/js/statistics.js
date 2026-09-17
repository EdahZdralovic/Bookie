const statisticsElement = document.getElementById('statistics-data');

if (statisticsElement && typeof Chart !== 'undefined') {
  const data = JSON.parse(statisticsElement.dataset.statistics);
  const labels = JSON.parse(statisticsElement.dataset.labels);
  const colors = ['#e77a4f', '#284b63', '#4f8a70', '#d6a84f', '#8c5a9e', '#6b7280'];
  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { position: 'bottom' } },
  };
  new Chart(document.getElementById('languageChart'), {
    type: 'pie',
    data: {
      labels: data.languages.map((item) => item.name),
      datasets: [{ data: data.languages.map((item) => item.count), backgroundColor: colors }],
    },
    options,
  });
  new Chart(document.getElementById('ordersChart'), {
    type: 'line',
    data: {
      labels: data.monthlyCompleted.map((item) => item.label),
      datasets: [
        {
          label: labels.SOLD,
          data: data.monthlyCompleted.map((item) => item.sold),
          borderColor: colors[0],
          tension: 0.3,
        },
        {
          label: labels.EXCHANGED,
          data: data.monthlyCompleted.map((item) => item.exchanged),
          borderColor: colors[1],
          tension: 0.3,
        },
      ],
    },
    options: { ...options, scales: { y: { beginAtZero: true, ticks: { precision: 0 } } } },
  });
  new Chart(document.getElementById('genreChart'), {
    type: 'radar',
    data: {
      labels: data.popularGenres.map((item) => item.name),
      datasets: [
        {
          label: labels.BOOKS,
          data: data.popularGenres.map((item) => item.count),
          borderColor: colors[2],
          backgroundColor: 'rgba(79,138,112,.2)',
        },
      ],
    },
    options: { ...options, scales: { r: { beginAtZero: true, ticks: { precision: 0 } } } },
  });
}
