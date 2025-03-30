// Constants
const STOCKS = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'PYPL', 'TSLA', 'JPM', 'NVDA', 'NFLX', 'DIS'];
// const STOCKS = ['AAPL'];
const API_BASE_URL = 'https://stocksapi-uhe1.onrender.com/api/stocks';

// State
let currentStock = null;
let currentRange = '1mo';
let chart = null;

// Initialize application
document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();
    initializeStockList();
});

// Setup event listeners
function setupEventListeners() {
    // Time range buttons
    document.querySelectorAll('.time-range button').forEach(button => {
        button.addEventListener('click', () => {
            document.querySelectorAll('.time-range button').forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            currentRange = button.dataset.range;
            if (currentStock) {
                updateChart(currentStock);
            }
        });
    });

    // Set initial active button
    document.querySelector('.time-range button[data-range="1mo"]').classList.add('active');
}

// Initialize stock list
async function initializeStockList() {
    const stockList = document.getElementById('stockList');
    stockList.innerHTML = '<div class="loading">Loading stocks...</div>';

    try {
        const response = await fetch(`${API_BASE_URL}/getstockstatsdata`);
        if (!response.ok) throw new Error('Failed to fetch stock profiles');
        
        const data = await response.json();
        if (!data.stocksStatsData || !data.stocksStatsData[0]) {
            throw new Error('Invalid data format');
        }

        const stocksStatsData = data.stocksStatsData[0];

        stockList.innerHTML = '';

        STOCKS.forEach(symbol => {
            if (stocksStatsData[symbol]) {
                const stockElement = createStockListItem(symbol, stocksStatsData[symbol]);
                stockList.appendChild(stockElement);
            }
        });

        // Select first stock by default
        if (STOCKS.length > 0) {
            selectStock(STOCKS[0]);
        }
    } catch (error) {
        console.error('Error initializing stock list:', error);
        stockList.innerHTML = '<div class="error">Failed to load stocks</div>';
    }
}

// Create stock list item
function createStockListItem(symbol, data) {
    const div = document.createElement('div');
    div.className = 'stock-item';
    const profitClass = data.profit > 0 ? 'profit-positive' : 'profit-negative';
    div.innerHTML = `
        <strong>${symbol}</strong>
        <div>Book Value: $${data.bookValue.toFixed(2)}</div>
        <div class="${profitClass}">
            ${data.profit >= 0 ? '+' : ''}${data.profit.toFixed(2)}%
        </div>
    `;
    div.addEventListener('click', () => selectStock(symbol));
    return div;
}

// Select a stock
async function selectStock(symbol) {
    currentStock = symbol;
    
    // Update UI selection
    document.querySelectorAll('.stock-item').forEach(item => {
        item.classList.toggle('selected', item.querySelector('strong').textContent === symbol);
    });

    // Update chart and details
    await Promise.all([
        updateChart(symbol),
        updateDetails(symbol)
    ]);
}

// Update chart
async function updateChart(symbol) {
    try {
        const response = await fetch(`${API_BASE_URL}/getstocksdata`);
        if (!response.ok) throw new Error('Failed to fetch stock data');
        
        const data = await response.json();
        if (!data.stocksData || !data.stocksData[0]) {
            throw new Error('Invalid data format');
        }

        const stocksData = data.stocksData[0];
        const stockData = stocksData[symbol];
        
        if (!stockData) throw new Error('Stock data not found');

        const { filteredDates, filteredPrices } = filterDataByTimeRange(stockData);
        
        // Update peak/low values
        const peakValue = Math.max(...filteredPrices);
        const lowValue = Math.min(...filteredPrices);
        document.getElementById('peakValue').textContent = `$${peakValue.toFixed(2)}`;
        document.getElementById('lowValue').textContent = `$${lowValue.toFixed(2)}`;

        // Create/update chart
        createChart(filteredDates, filteredPrices, symbol);
    } catch (error) {
        console.error('Error updating chart:', error);
        // Clear chart and show error state
        if (chart) {
            chart.destroy();
            chart = null;
        }
        document.getElementById('peakValue').textContent = '--';
        document.getElementById('lowValue').textContent = '--';
    }
}

// Filter data by time range
function filterDataByTimeRange(stockData) {
    const chartData = stockData[currentRange];

    const filteredData = chartData.timeStamp.reduce((acc, timestamp, index) => {
        acc.dates.push(new Date(timestamp * 1000).toLocaleDateString());
        acc.prices.push(chartData.value[index]);
        return acc;
    }, { dates: [], prices: [] });

    return {
        filteredDates: filteredData.dates,
        filteredPrices: filteredData.prices
    };
}

// Create/update chart
function createChart(dates, prices, symbol) {
    const ctx = document.getElementById('stockChart').getContext('2d');
    
    if (chart) {
        chart.destroy();
    }

    chart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: dates,
            datasets: [{
                label: `${symbol} Stock Price`,
                data: prices,
                borderColor: '#0d6efd',
                backgroundColor: 'rgba(13, 110, 253, 0.1)',
                fill: true,
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                intersect: false,
                mode: 'index'
            },
            plugins: {
                tooltip: {
                    callbacks: {
                        label: (context) => `Price: $${context.parsed.y.toFixed(2)}`
                    }
                }
            },
            scales: {
                x: {
                    grid: {
                        display: false
                    }
                },
                y: {
                    beginAtZero: false
                }
            }
        }
    });
}

// Update details section
async function updateDetails(symbol) {
    try {
        const [profileResponse, statsResponse] = await Promise.all([
            fetch(`${API_BASE_URL}/getstocksprofiledata`),
            fetch(`${API_BASE_URL}/getstockstatsdata`)
        ]);

        if (!profileResponse.ok || !statsResponse.ok) {
            throw new Error('Failed to fetch stock details');
        }

        const [profileData, statsData] = await Promise.all([
            profileResponse.json(),
            statsResponse.json()
        ]);

        if (!profileData.stocksProfileData || !profileData.stocksProfileData[0] ||
            !statsData.stocksStatsData || !statsData.stocksStatsData[0]) {
            throw new Error('Invalid data format');
        }

        const profile = profileData.stocksProfileData[0][symbol];
        const stats = statsData.stocksStatsData[0][symbol];

        if (!profile || !stats) {
            throw new Error('Stock details not found');
        }

        // Update UI
        document.getElementById('stockName').textContent = symbol;
        document.getElementById('bookValue').textContent = `$${stats.bookValue.toFixed(2)}`;
        
        const profitElement = document.getElementById('profit');
        const profitValue = stats.profit;
        profitElement.textContent = `${profitValue > 0 ? '+' : ''}${profitValue.toFixed(2)}%`;
        profitElement.className = profitValue > 0 ? 'profit-positive' : 'profit-negative';
        
        document.getElementById('summary').textContent = profile.summary;
    } catch (error) {
        console.error('Error updating details:', error);
        // Show error state in details section
        document.getElementById('stockName').textContent = symbol;
        document.getElementById('bookValue').textContent = '--';
        document.getElementById('profit').textContent = '--';
        document.getElementById('summary').textContent = 'Failed to load stock details';
    }
} 