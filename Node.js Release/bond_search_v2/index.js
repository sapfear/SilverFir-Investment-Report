/**
 * SilverFir: Investment Report 🌲 [Node.js Release]
 * https://fir.icu/
 *
 * Модуль поиска облигаций по параметрам [bond_search_v2/index.js]
 *
 * Запуск под Linux: $ npm start
 * Запуск под Windows: start.bat
 * Подробности: https://habr.com/ru/post/506720/
 *
 * Docker fork: https://github.com/supaflyster/SilverFir-Investment-Report
 *
 * @author Mikhail Shardin [Михаил Шардин]
 * https://www.facebook.com/mikhail.shardin/
 *
 * Last updated: 23.05.2020
 *
 */

const config = {
    YieldMore: 6, //Доходность больше этой цифры
    YieldLess: 40, //Доходность меньше этой цифры
    PriceMore: 80, //Цена больше этой цифры
    PriceLess: 101, //Цена меньше этой цифры
    DurationMore: 0, //Дюрация больше этой цифры
    DurationLess: 26, //Дюрация меньше этой цифры
    VolumeMore: 5000, //Объем сделок за n дней, шт. больше этой цифры
};

const trashConfig = {
    YieldMore: 6, //Доходность больше этой цифры
    YieldLess: 100, //Доходность меньше этой цифры
    PriceMore: 60, //Цена больше этой цифры
    PriceLess: 101, //Цена меньше этой цифры
    DurationMore: 0, //Дюрация больше этой цифры
    DurationLess: 26, //Дюрация меньше этой цифры
    VolumeMore: 1000, //Объем сделок за n дней, шт. больше этой цифры
};

bond_search_v2();

async function bond_search_v2() {
    let startTime = (new Date()).getTime(); //записываем текущее время в формате Unix Time Stamp - Epoch Converter
    console.log("Функция %s начала работу в %s. \n", getFunctionName(), (new Date()).toLocaleString());

    global.fetch = require("node-fetch");
    global.fs = require("fs");

    await MOEXsearchBonds();

    const currTime = (new Date()).getTime();
    const duration = Math.round((currTime - startTime) / 1000 / 60 * 100) / 100; //время выполнения скрипта в минутах

    console.log("\nФункция %s закончила работу в %s.", getFunctionName(), (new Date()).toLocaleString());
    console.log("Время выполнения %s в минутах: %s.", getFunctionName(), duration);
}

/**
 * Основная функция
 */

async function MOEXsearchBonds() { //поиск облигаций по параметрам
    const { YieldMore, YieldLess, PriceMore, PriceLess, DurationMore, DurationLess, VolumeMore, } = config;

    const conditions = `
        <li>${YieldMore}% < Доходность < ${YieldLess}%</li>
        <li>${PriceMore}% < Цена < ${PriceLess}%</li>
        <li>${DurationMore} мес. < Дюрация < ${DurationLess} мес.</li> 
        <li>Объем сделок за n дней > ${VolumeMore} шт.</li>
        <li>Поиск в Т0, Т+, Т+ (USD) - Основной режим - безадрес.</li>
    `;
    const logs = [`<li>Поиск начат ${new Date().toLocaleString()}.</li>`];
    const bonds = [
        // ["BondName", "SECID", "BondPrice", "BondVolume", "BondYield", "BondDuration", "BondTax"],
    ];

    await Promise.all(
        [7, 58, 193, 227].map(async t => { // https://iss.moex.com/iss/engines/stock/markets/bonds/boardgroups/
            const url = `https://iss.moex.com/iss/engines/stock/markets/bonds/boardgroups/${t}/securities.json?iss.dp=comma&iss.meta=off&iss.only=securities,marketdata&securities.columns=SECID,SECNAME,PREVLEGALCLOSEPRICE,LISTLEVEL&marketdata.columns=SECID,YIELD,DURATION,LISTLEVEL`;
            console.log('%s. Ссылка поиска всех доступных облигаций группы: %s', getFunctionName(), url);

            logs.push('<li><b>Ссылка поиска всех доступных облигаций группы: ' + url + '.</b></li>');

            try {
                const { securities: { data: securitiesData }, marketdata: { data: marketdata } } = await fetch(url).then(resp => resp.json());

                if (marketdata.length === 0) {
                    console.log('%s. Нет данных c Московской биржи. Проверьте вручную по ссылке выше.', getFunctionName());

                    return;
                }

                let securitiesCount = securitiesData.length;

                //console.log('%s. Всего в списке: %s бумаг.', getFunctionName(), securitiesCount);
                logs.push(`<li>Всего в списке: ${securitiesCount} бумаг.</li>`);

                for (let i = 0; i <= securitiesCount - 1; i++) {
                    const bondName = securitiesData[i][1].replace(/\"/g, '').replace(/\'/g, '');
                    const SECID = securitiesData[i][0];
                    const bondPrice = securitiesData[i][2];
                    const bondYield = marketdata[i][1];
                    const bondListLevel = securitiesData[i][3];
                    const bondDuration = Math.floor((marketdata[i][2] / 30) * 100) / 100; // кол-во оставшихся месяцев

                    //console.log('%s. Работа со строкой %s из %s: %s (%s).', getFunctionName(), (i + 1), securitiesCount, bondName, SECID);
                    logs.push('<li>Работа со строкой ' + (i + 1) + ' из ' + securitiesCount + ': ' + SECID + ' (' + bondYield + '%, ' + bondPrice + ').</li>');

                    if (bondYield > YieldMore && bondYield < YieldLess && //условия выборки
                        bondPrice > PriceMore && bondPrice < PriceLess &&
                        bondDuration > DurationMore && bondDuration < DurationLess) {

                        const bondVolume = await MOEXsearchVolume(SECID);
                        if (bondVolume > VolumeMore) { //если оборот в бумагах больше этой цифры
                            const bondTax = await MOEXsearchTax(SECID);
                            bonds.push([bondName, SECID, bondPrice, bondVolume, bondYield, bondDuration, bondTax, bondListLevel, t === 227]);

                            console.log('%s. Cтрока № %s: %s.', getFunctionName(), bonds.length, JSON.stringify(bonds[bonds.length - 1]));
                            logs.push(`<li><b>Cтрока № ${bonds.length}: ${JSON.stringify(bonds[bonds.length - 1])}.</b></li>`);
                        }
                    }
                }
            } catch (e) {
                const message = `Ошибка в ${getFunctionName()}`;

                console.log(message);
                logs.push(`<li>${message}</li>`);
            }
        })
    );

    if (bonds.length === 0) {
        console.log('В массиве нет строк', getFunctionName());

        return;
    }

    await HTMLgenerate(bonds, conditions, logs);
}

/**
 * Дополнительные функции
 */

async function MOEXsearchTax(ID) { //налоговые льготы для корпоративных облигаций, выпущенных с 1 января 2017 года
    const url = `https://iss.moex.com/iss/securities/${ID}.json?iss.meta=off&iss.only=description`;

    console.log('%s. Ссылка для %s: %s', getFunctionName(), ID, url);

    try {
        const { description: { data } } = await fetch(url).then(resp => resp.json());

        const startDateMoex = data.find(e => e[0] === 'STARTDATEMOEX')[2];
        // DAYSTOREDEMPTION = json.description.data.find(e => e[0] === 'DAYSTOREDEMPTION')[2]; //получение кол-ва оставшихся дней по погашения
        console.log("%s. Дата принятия решения о включении ценной бумаги в Список для %s: %s.", getFunctionName(), ID, startDateMoex);
        const isDateLater = new Date(startDateMoex) > new Date('2017-01-01');

        return isDateLater;
    } catch (e) {
        console.log('Ошибка в %s', getFunctionName())
    }
}

async function MOEXsearchVolume(ID) { //суммирование оборотов по корпоративной облигации за последние n дней
    const now = new Date();
    const DateRequestPrevious = `${now.getFullYear()}-${now.getMonth() - 1}-${now.getDate()}`; //этот день 2 месяца назад

    const boardID = await MOEXboardID(ID);

    if (!boardID) {
        return
    }

    const url = `https://iss.moex.com/iss/history/engines/stock/markets/bonds/boards/${boardID}/securities/${ID}.json?iss.meta=off&iss.only=history&history.columns=SECID,TRADEDATE,VOLUME,NUMTRADES&limit=61&from=${DateRequestPrevious}`;

    // numtrades - Минимальное количество сделок с бумагой
    // VOLUME - оборот в количестве бумаг (Объем сделок, шт)

    console.log('%s. Ссылка для %s: %s', getFunctionName(), ID, url);

    try {
        const { history: { data: list } } = await fetch(url).then(resp => resp.json());
        const volume_sum = list.reduce((acc, bond) => {
            return acc + bond[2];
        }, 0);

        console.log("%s. Оборот в бумагах (объем сделок, шт) для %s за последние %s дней: %s штук.", getFunctionName(), ID, list.length, volume_sum);

        return volume_sum;
    } catch (e) {
        console.log('Ошибка в %s', getFunctionName())
    }
}

async function MOEXboardID(ID) { //узнаем boardid любой бумаги по тикеру
    const url = `https://iss.moex.com/iss/securities/${ID}.json?iss.meta=off&iss.only=boards&boards.columns=secid,boardid,is_primary`;

    try {
        const { boards: { data }} = await fetch(url).then(resp => resp.json());
        const boardID = data.find(e => e[2] === 1)[1];

        console.log("%s. boardID для %s: %s", getFunctionName(), ID, boardID);
        return boardID;
    } catch (e) {
        console.log('Ошибка в %s', getFunctionName())
    }
}

/**
 * Общие вспомогательные функции
 */

function getGoogleRowString(bonds) {
    return bonds.map(bond => {
        bond[1] = `<a href="https://smart-lab.ru/q/bonds/${bond[1]}/" target="_blank">${bond[1]}</a>`;

        return bond;
    });
}

async function HTMLgenerate(bonds, conditions, logs) { //генерирование HTML https://developers.google.com/chart/interactive/docs/gallery/table?hl=ru
    const hmtl = `
    <!DOCTYPE html>
    <html lang="ru">

    <head>
        <meta charset="utf-8">
        <title>Мосбиржа. Фильтр облигаций</title>
        <script type="text/javascript" src="https://www.gstatic.com/charts/loader.js"></script>
        <script type="text/javascript">
            google.charts.load('current', {
                'packages': ['table']
            });
            google.charts.setOnLoadCallback(drawTable);

            function drawTable() {
                const data = new google.visualization.DataTable();

                data.addColumn('string', 'Полное наименование');
                data.addColumn('string', 'Код ценной бумаги');
                data.addColumn('number', 'Цена, %');
                data.addColumn('number', 'Объем сделок за n дней, шт.');
                data.addColumn('number', 'Доходность');
                data.addColumn('number', 'Дюрация, мес');
                data.addColumn('boolean', 'Льгота');
                data.addColumn('number', 'Уроверь листинга');
                data.addColumn('boolean', 'ПИР');
                data.addRows(
                    ${JSON.stringify(getGoogleRowString(bonds))}
                );
                const table = new google.visualization.Table(document.getElementById('table_div'));
                
                table.draw(data, {
                    showRowNumber: true,
                    width: '100%',
                    height: '100%',
                    sortColumn: 4,
                    sortAscending: false,
                    allowHtml: true
                });
            }
        </script>
    </head>

    <body>
        <noscript>
            ${makeTableHTML(bonds)}
            <small>(JavaScript в этом браузере отключён, поэтому таблица не динамическая)</small>
        </noscript>
        <div id="table_div"></div>
        <p>Выборка сгенерирована ${new Date().toLocaleString()} по условиям 📜:
        <ul>
            ${conditions}
        </ul>
        <details>
            <summary>Техническая информация</summary><small>
                <ol>
                    ${logs.join('\n')}
                </ol>
            </small>
        </details>
    </body>

    </html>`;

    fs.writeFileSync(`./bonds/bond_search_${new Date().toLocaleString().replace(/[\:\s]/g, '-')}.html`, hmtl)

}

function makeTableHTML(bonds) { //генерируем html таблицу из массива
    let result = `<table style="text-align: center; border: 1px solid green; border-collapse: collapse; border-style: hidden;">
        <tr>
            <td>Полное наименование</td>
            <td>Код ценной бумаги</td>
            <td>Цена, %</td>
            <td>Объем сделок за n дней, шт.</td>
            <td>Доходность</td>
            <td>Дюрация, мес</td>
            <td>Льгота</td>
            <td>Уроверь листинга</td>
            <td>ПИР</td>
        </tr>`;

    result += bonds.map(bond => {
        return [
            '<tr>',
            bond.map((bondVal, index) => {
                return [
                    '<td style="border: 1px solid green;">',
                    index === 1 ? `<a href="https://smart-lab.ru/q/bonds/${bondVal}/">${bondVal}</a>` : bondVal,
                    '</td>'
                ].join('')
            }).join(''),
            '</tr>'
        ].join('');
    }).join('');

    result += "</table>";

    return result;
}

function getFunctionName() { //автоматически получаем имя функции
    return (new Error()).stack.split('\n')[2].split(' ')[5];
}
