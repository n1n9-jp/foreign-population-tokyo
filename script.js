// データの読み込みと処理
let data = {};
let visibleWards = new Set();
let yearExtent = { min: Infinity, max: -Infinity };
let selectedYearRange = null;
let suppressSliderChange = false;

// 自治体のカテゴリー分類
const wards23 = ['千代田区', '中央区', '港区', '新宿区', '渋谷区', '目黒区', '大田区', '品川区', '世田谷区', '中野区', '杉並区', '豊島区', '北区', '荒川区', '台東区', '墨田区', '江東区', '江戸川区', '葛飾区', '板橋区', '練馬区', '足立区', '文京区'];
const wardsTama = ['八王子市', '立川市', '武蔵野市', '三鷹市', '青梅市', '府中市', '昭島市', '調布市', '町田市', '小金井市', '小平市', '日野市', '東村山市', '国分寺市', '国立市', '福生市', '狛江市', '東大和市', '清瀬市', '東久留米市', '武蔵村山市', '多摩市', '稲城市', '羽村市', 'あきる野市', '瑞穂町'];
const wardsIslands = ['日の出町', '奥多摩町', '大島支庁', '八丈支庁', '三宅支庁', '小笠原支庁'];
const excludedWards = new Set(['町村部', '郡部', '群部', '島部']);

// 色の割り当て
const wardColors = {};

// 複数のカラースキームを組み合わせて、59以上の色を作成
const colorSchemes = [
    d3.schemeCategory10,
    d3.schemeAccent,
    d3.schemeDark2,
    d3.schemePaired,
    d3.schemeSet1,
    d3.schemeSet2,
    d3.schemeSet3,
    ['#e41a1c', '#377eb8', '#4daf4a', '#984ea3', '#ff7f00', '#a65628', '#f781bf', '#999999'],
];

let colorIndex = 0;
const allColors = [];
for (let scheme of colorSchemes) {
    for (let color of scheme) {
        allColors.push(color);
    }
}

// データ読み込み
d3.json('china_population_by_ward.json').then(rawData => {
    data = Object.fromEntries(
        Object.entries(rawData).filter(([ward]) => !excludedWards.has(ward))
    );

    yearExtent = { min: Infinity, max: -Infinity };
    Object.values(data).forEach(records => {
        records.forEach(({ year }) => {
            if (year < yearExtent.min) yearExtent.min = year;
            if (year > yearExtent.max) yearExtent.max = year;
        });
    });

    if (!Number.isFinite(yearExtent.min) || !Number.isFinite(yearExtent.max)) {
        console.error('年データの取得に失敗しました。');
        return;
    }

    selectedYearRange = [yearExtent.min, yearExtent.max];
    initSlider();

    // 色の割り当て
    let colorIndex = 0;
    Object.keys(data).forEach(ward => {
        wardColors[ward] = allColors[colorIndex % allColors.length];
        colorIndex++;
    });

    // デフォルトではトップ15を表示
    const allWards = Object.keys(data);
    const top15 = allWards.slice(0, 15);
    visibleWards = new Set(top15);

    initChart();
}).catch(error => {
    console.error('データ読み込みエラー:', error);
    document.getElementById('chart').innerHTML = '<p style="color: red; text-align: center; padding: 20px;">データを読み込めませんでした。</p>';
});

function initChart() {
    // 凡例の作成
    const legendDiv = d3.select('#legend');
    Object.keys(data).forEach(ward => {
        const item = legendDiv.append('div')
            .attr('class', 'legend-item')
            .attr('data-ward', ward)
            .on('click', () => toggleWard(ward, item));

        item.append('div')
            .attr('class', 'legend-color')
            .style('background-color', wardColors[ward]);

        item.append('span')
            .attr('class', 'legend-label')
            .text(ward);
    });

    // ボタンの機能
    d3.select('#selectAll').on('click', () => {
        visibleWards.clear();
        const allWards = Object.keys(data);
        allWards.forEach(ward => visibleWards.add(ward));
        d3.selectAll('.legend-item').classed('inactive', false);
        updateChart();
    });

    d3.select('#clearAll').on('click', () => {
        visibleWards.clear();
        d3.selectAll('.legend-item').classed('inactive', true);
        updateChart();
    });

    // カテゴリー選択ボタン
    d3.select('#select23').on('click', () => {
        visibleWards.clear();
        wards23.forEach(ward => {
            if (data[ward]) {
                visibleWards.add(ward);
            }
        });
        updateLegendAndChart();
    });

    d3.select('#selectTama').on('click', () => {
        visibleWards.clear();
        wardsTama.forEach(ward => {
            if (data[ward]) {
                visibleWards.add(ward);
            }
        });
        updateLegendAndChart();
    });

    d3.select('#selectIslands').on('click', () => {
        visibleWards.clear();
        wardsIslands.forEach(ward => {
            if (data[ward]) {
                visibleWards.add(ward);
            }
        });
        updateLegendAndChart();
    });

    d3.select('#downloadSVG').on('click', downloadSVG);
    d3.select('#downloadPNG').on('click', downloadPNG);
    d3.select('#rangeAllYears').on('click', () => setYearRange(yearExtent.min, yearExtent.max));
    d3.select('#rangeEarlyYears').on('click', () => setYearRange(Math.max(yearExtent.min, 1979), Math.min(yearExtent.max, 1999)));
    d3.select('#rangeRecentYears').on('click', () => setYearRange(Math.max(yearExtent.min, 2000), Math.min(yearExtent.max, 2025)));

    updateChart();
}

function toggleWard(ward, item) {
    if (visibleWards.has(ward)) {
        visibleWards.delete(ward);
        item.classed('inactive', true);
    } else {
        visibleWards.add(ward);
        item.classed('inactive', false);
    }
    updateChart();
}

function updateLegendAndChart() {
    // 凡例の状態を更新
    d3.selectAll('.legend-item').classed('inactive', function() {
        const ward = d3.select(this).attr('data-ward');
        return !visibleWards.has(ward);
    });
    updateChart();
}

function updateChart() {
    const chartSelection = d3.select('#chart');
    chartSelection.html('');

    if (!selectedYearRange) {
        chartSelection.html('<p style="text-align: center; color: #999; padding: 40px;">年範囲を初期化しています...</p>');
        return;
    }

    if (visibleWards.size === 0) {
        updateStats([]);
        chartSelection.html('<p style="text-align: center; color: #999; padding: 40px;">表示する自治体を選択してください</p>');
        return;
    }

    const filteredData = getVisibleDataWithinRange();
    updateStats(filteredData);

    if (filteredData.length === 0) {
        chartSelection.html('<p style="text-align: center; color: #999; padding: 40px;">選択した期間にはデータがありません</p>');
        return;
    }

    drawChart(filteredData);
}


function drawChart(filteredData) {
    // マージンの設定
    const margin = { top: 20, right: 180, bottom: 40, left: 60 };
    const chartContainer = document.querySelector('.chart-container');
    const containerWidth = chartContainer ? chartContainer.clientWidth : 600;
    const width = containerWidth - margin.left - margin.right;
    const height = Math.max(800, filteredData.length * 16) * (2 / 3);

    // SVGの作成
    const svg = d3.select('#chart')
        .append('svg')
        .attr('width', '100%')
        .attr('height', 'auto')
        .attr('viewBox', `0 0 ${width + margin.left + margin.right} ${height + margin.top + margin.bottom}`)
        .attr('preserveAspectRatio', 'xMidYMid meet')
        .style('display', 'block');

    const g = svg.append('g')
        .attr('transform', `translate(${margin.left},${margin.top})`);

    // データの準備
    const [startYear, endYear] = selectedYearRange;

    // スケールの設定
    const yMax = d3.max(filteredData, d => d3.max(d.values, v => v.population));
    const effectiveYMax = yMax ? yMax * 1.1 : 1;

    const xScale = d3.scaleLinear()
        .domain([startYear, endYear])
        .range([0, width]);

    const yScale = d3.scaleLinear()
        .domain([0, effectiveYMax])
        .range([height, 0]);

    // グリッドラインの追加
    g.append('g')
        .attr('class', 'grid-line')
        .attr('opacity', 0.1)
        .call(d3.axisLeft(yScale)
            .tickSize(-width)
            .tickFormat('')
        );

    // X軸
    g.append('g')
        .attr('transform', `translate(0,${height})`)
        .attr('class', 'axis')
        .call(d3.axisBottom(xScale)
            .tickFormat(d3.format('d'))
            .ticks(10))
        .append('text')
        .attr('class', 'axis-label')
        .attr('x', width / 2)
        .attr('y', 35)
        .attr('text-anchor', 'middle')
        .text('年');

    // Y軸
    g.append('g')
        .attr('class', 'axis')
        .call(d3.axisLeft(yScale)
            .ticks(8))
        .append('text')
        .attr('class', 'axis-label')
        .attr('transform', 'rotate(-90)')
        .attr('y', -45)
        .attr('x', -height / 2)
        .attr('text-anchor', 'middle')
        .text('人口（人）');

    // 折れ線ジェネレーター
    const line = d3.line()
        .x(d => xScale(d.year))
        .y(d => yScale(d.population));

    // 折れ線の描画
    const lines = g.selectAll('.line-group')
        .data(filteredData)
        .enter()
        .append('g')
        .attr('class', 'line-group');

    lines.append('path')
        .attr('class', d => `line ward-${d.ward.replace(/[^\w]/g, '')}`)
        .attr('d', d => line(d.values))
        .style('stroke', d => wardColors[d.ward]);

    // ドットの追加
    lines.selectAll('.dot')
        .data(d => d.values.map(v => ({ ...v, ward: d.ward })))
        .enter()
        .append('circle')
        .attr('class', 'dot')
        .attr('cx', d => xScale(d.year))
        .attr('cy', d => yScale(d.population))
        .attr('r', 3)
        .style('stroke', d => wardColors[d.ward])
        .on('mouseover', function(e, d) {
            showTooltip(e, d);
            const ward = d.ward;
            g.selectAll('.line-group').classed('inactive', grp => grp.ward !== ward);
        })
        .on('mouseout', function() {
            hideTooltip();
            g.selectAll('.line-group').classed('inactive', false);
        });

    // 自治体名ラベルの追加（折れ線の右側）
    // 常に追加
    lines.append('text')
        .attr('class', 'ward-label')
        .attr('x', d => xScale(d.values[d.values.length - 1].year) + 8)
        .attr('y', d => yScale(d.values[d.values.length - 1].population) + 4)
        .attr('fill', d => wardColors[d.ward])
        .style('font-weight', 'bold')
        .style('font-size', '11px')
        .text(d => d.ward);
}

function getVisibleDataWithinRange() {
    const [startYear, endYear] = selectedYearRange;
    return Array.from(visibleWards)
        .map(ward => {
            const records = data[ward] || [];
            const filteredValues = records
                .filter(d => d.year >= startYear && d.year <= endYear)
                .sort((a, b) => a.year - b.year);
            return { ward, values: filteredValues };
        })
        .filter(entry => entry.values.length > 0);
}

function updateStats(filteredData) {
    const [startYear, endYear] = selectedYearRange;

    const totals = Object.values(data)
        .map(records => records.find(d => d.year === endYear))
        .filter(Boolean);
    const totalPop = totals.reduce((sum, d) => sum + d.population, 0);

    d3.select('#totalPopulation').text(
        totals.length ? `${totalPop.toLocaleString()}人` : '-'
    );
    d3.select('#wardCount').text(filteredData.length.toString());
    d3.select('#period').text(`${startYear}年-${endYear}年`);
}

function updateYearRangeLabel(range) {
    const label = document.getElementById('yearRangeLabel');
    if (label) {
        label.textContent = `${range[0]}年 - ${range[1]}年`;
    }
}

function initSlider() {
    const sliderElement = document.getElementById('yearSlider');
    if (!sliderElement || typeof noUiSlider === 'undefined' || typeof wNumb === 'undefined') {
        return;
    }

    if (sliderElement.noUiSlider) {
        sliderElement.noUiSlider.destroy();
    }

    const format = wNumb({ decimals: 0 });
    noUiSlider.create(sliderElement, {
        start: selectedYearRange,
        connect: true,
        step: 1,
        range: {
            min: yearExtent.min,
            max: yearExtent.max
        },
        format,
        tooltips: [format, format],
        pips: {
            mode: 'count',
            values: 6,
            density: 4,
            format
        }
    });

    updateYearRangeLabel(selectedYearRange);

    sliderElement.noUiSlider.on('update', (values) => {
        const start = Number(values[0]);
        const end = Number(values[1]);
        updateYearRangeLabel([start, end]);
    });

    sliderElement.noUiSlider.on('change', (values) => {
        if (suppressSliderChange) {
            return;
        }
        const start = Math.round(Number(values[0]));
        const end = Math.round(Number(values[1]));
        selectedYearRange = [start, end];
        updateChart();
    });
}

function setYearRange(start, end) {
    if (!selectedYearRange) {
        return;
    }

    const clampedStart = Math.max(yearExtent.min, Math.min(yearExtent.max, start));
    const clampedEnd = Math.max(clampedStart, Math.min(yearExtent.max, end));
    selectedYearRange = [clampedStart, clampedEnd];
    updateYearRangeLabel(selectedYearRange);

    const sliderElement = document.getElementById('yearSlider');
    const slider = sliderElement ? sliderElement.noUiSlider : null;

    if (slider) {
        suppressSliderChange = true;
        slider.set(selectedYearRange);
        suppressSliderChange = false;
    }

    updateChart();
}

function collectCssText() {
    let cssText = '';
    const styleSheets = Array.from(document.styleSheets || []);
    styleSheets.forEach(sheet => {
        try {
            const rules = sheet.cssRules;
            if (!rules) {
                return;
            }
            Array.from(rules).forEach(rule => {
                cssText += rule.cssText + '\n';
            });
        } catch (error) {
            console.warn('スタイルの取得に失敗しました:', error);
        }
    });
    return cssText.trim();
}

function serializeSvg(svgNode) {
    const clone = svgNode.cloneNode(true);
    const viewBox = svgNode.viewBox.baseVal;
    const width = viewBox && viewBox.width ? viewBox.width : svgNode.getBoundingClientRect().width;
    const height = viewBox && viewBox.height ? viewBox.height : svgNode.getBoundingClientRect().height;

    clone.setAttribute('width', width);
    clone.setAttribute('height', height);
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    clone.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');

    const cssText = collectCssText();
    if (cssText) {
        const style = document.createElementNS('http://www.w3.org/2000/svg', 'style');
        style.setAttribute('type', 'text/css');
        style.textContent = cssText;
        clone.insertBefore(style, clone.firstChild);
    }

    const serializer = new XMLSerializer();
    const svgString = serializer.serializeToString(clone);

    return { svgString, width, height };
}

function triggerDownload(url, filename) {
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function downloadSVG() {
    const svgNode = d3.select('#chart svg').node();
    if (!svgNode) {
        alert('チャートが表示されていません。');
        return;
    }

    const { svgString } = serializeSvg(svgNode);
    const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    triggerDownload(url, 'tokyo-chinese-population.svg');
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function downloadPNG() {
    const svgNode = d3.select('#chart svg').node();
    if (!svgNode) {
        alert('チャートが表示されていません。');
        return;
    }

    const { svgString, width, height } = serializeSvg(svgNode);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, width, height);

    const img = new Image();
    const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);

    img.onload = () => {
        context.drawImage(img, 0, 0, width, height);
        URL.revokeObjectURL(url);
        if (canvas.toBlob) {
            canvas.toBlob(blob => {
                if (!blob) {
                    alert('PNGの生成に失敗しました。');
                    return;
                }
                const pngUrl = URL.createObjectURL(blob);
                triggerDownload(pngUrl, 'tokyo-chinese-population.png');
                setTimeout(() => URL.revokeObjectURL(pngUrl), 1000);
            });
        } else {
            const dataUrl = canvas.toDataURL('image/png');
            triggerDownload(dataUrl, 'tokyo-chinese-population.png');
        }
    };

    img.onerror = () => {
        URL.revokeObjectURL(url);
        alert('PNGの生成に失敗しました。');
    };

    img.src = url;
}

function showTooltip(e, d) {
    let tooltip = d3.select('.tooltip');
    if (tooltip.empty()) {
        tooltip = d3.select('body')
            .append('div')
            .attr('class', 'tooltip');
    }

    tooltip
        .style('display', 'block')
        .style('left', (e.pageX + 10) + 'px')
        .style('top', (e.pageY - 10) + 'px')
        .html(`<strong>${d.ward}</strong><br/>${d.year}年: ${d.population.toLocaleString()}人`);
}

function hideTooltip() {
    d3.select('.tooltip').style('display', 'none');
}

// リサイズ対応
window.addEventListener('resize', () => {
    if (visibleWards.size > 0) {
        updateChart();
    }
});
