
/* Taken from: https://www.picobrew.com/Scripts/Recipes/helpers.js */

// Sticky Header ()
$(window).scroll(function () {
    if ($(window).scrollTop() >= 450) {
        $('#zc_header').insertAfter($('.pico-nav'));
        $('#zc_header').addClass('zc_sticky_header');
    }
    else {
        $('#zc_header').removeClass('zc_sticky_header');
    }
});


function googleChartRow(name, value) {
    return {
        c: [
            { v: name },
            { v: value },
        ]
    }
};
function brewGraphRow(time, step_name, temp) {
    return {
        c: [
            { v: time, f: step_name },
            { v: temp }
        ]
    }
};

function getToolTip(ingredients) {
    return {
        trigger: (ingredients.length > 0 ? 'hover' : 'none')
    }
}

function minutesToTimeString(n) {
    var num = n;
    var hours = (num / 60);
    var rhours = Math.floor(hours);
    var minutes = (hours - rhours) * 60;
    var rminutes = Math.round(minutes);
    return rhours + " hr" + (rhours > 1 ? "s" : "") + " and " + rminutes + " min" + (rminutes > 1 ? "s" : "");
}
function fixUnits(recipe) {
    for (var i = 0; i < recipe.BoilSteps.length; i++) {
        recipe.BoilSteps[i].Temp = Math.round(recipe.BoilSteps[i].Temp);
    }

    return recipe;
}
function getIngredientChartRows(ingredients, type) {
    var result = [];
    if (ingredients.length == 0) {
        result.push(new googleChartRow("No " + type, 1));
    }
    else {
        for (var i = 0; i < ingredients.length; i++) {
            if (ingredients[i].Amount > 0) {
                result.push(new googleChartRow(ingredients[i].Name, ingredients[i].Amount));
            }
        }
    }
    return result;
};

// Constants For heating gain\loss  //
var HeatingSlopeCelsiusPerMin = 4.96;
var HeatLossSlopeCelsiusPerMin = 0.585;
var HeatingSlopeFarenheightPerMin = HeatingSlopeCelsiusPerMin * (9 / 5);
var HeatLossSlopeFarenheightPerMin = HeatLossSlopeCelsiusPerMin * (9 / 5);

function getBrewGraphData(recipe) {
    var chart_rows = [];
    var total_time = 0;
    var _chill_time = 0;
    if (recipe.MachineSteps != null && recipe.MachineSteps.length > 0) {
        var current_time = 0;
        var ambient_temp_f = 55;
        var ambient_temp_c = 12.7;
        var current_temp = recipe.IsMetric ? ambient_temp_c : ambient_temp_f; //Set current temp to ambient temp (55F or )
        // start temp = 55F
        for (var i = 0; i < recipe.MachineSteps.length; i++) {
            // 6 = pause
            var is_chill_step = (i == recipe.MachineSteps.length - 1) && recipe.MachineSteps[i].Temperature < current_temp;
            if (recipe.MachineSteps[i].StepLocation != 6) {
                var next_temp = recipe.MachineSteps[i].Temperature;
                if (next_temp > 0) {
                    // Change in temp, calc machine step time
                    if (next_temp != current_temp) {
                        var step_title = next_temp > current_temp
                            ? "Heat To Temp"
                            : "Cool To Temp";
                        if (!is_chill_step) {
                            chart_rows.push(new brewGraphRow(current_time, step_title, current_temp));
                        }
                        var change_temp_time = next_temp > current_temp
                            ? (recipe.IsMetric
                                ? (recipe.MachineSteps[i].Temperature - current_temp) / HeatingSlopeCelsiusPerMin
                                : (recipe.MachineSteps[i].Temperature - current_temp) / HeatingSlopeFarenheightPerMin)
                            : (recipe.IsMetric
                                ? (current_temp - recipe.MachineSteps[i].Temperature) / HeatLossSlopeCelsiusPerMin
                                : (current_temp - recipe.MachineSteps[i].Temperature) / HeatLossSlopeFarenheightPerMin);
                        if (!is_chill_step) {
                            current_time += change_temp_time;
                        }
                        else {
                            _chill_time = change_temp_time;
                        }
                    }
                    if (!is_chill_step) {
                        current_temp = recipe.MachineSteps[i].Temperature
                        chart_rows.push(new brewGraphRow(current_time, recipe.MachineSteps[i].Name, recipe.MachineSteps[i].Temperature));
                        current_time += recipe.MachineSteps[i].Time;
                        if (recipe.MachineSteps[i].Drain > 0) {
                            current_time += recipe.MachineSteps[i].Drain;
                            chart_rows.push(new brewGraphRow(current_time, "Drain", recipe.MachineSteps[i].Temperature));
                        }
                    }
                }
            }
            else {
                chart_rows.push(new brewGraphRow(current_time, recipe.MachineSteps[i].Name, current_temp)); // FOr pause
            }
        }
        total_time = current_time;
    }
    else {
        chart_rows.push(new brewGraphRow("No Machine Steps", "", 1));
    }
    return {
        rows: chart_rows,
        time: minutesToTimeString(Math.round(total_time)),
        chill_time: minutesToTimeString(Math.round(_chill_time))
    };

};


function getZBrewSimData(recipe) {
    var chart_data = getBrewGraphData(recipe);
    var _chart = {
        type: 'LineChart'
        , data: {
            cols: [
                { id: "Minutes", label: "Minutes", type: "number" },
                { id: "Temp", Temp: "Temp", type: "number" }
            ]
            , rows: chart_data.rows
        },
        options: {
            selectionMode: 'multiple',
            hAxis: {
                title: 'Time (mins)',
                titleTextStyle: {
                    italic: false,
                    bold: false
                },
                textPosition: 'out',
                minValue: 0,
                viewWindow: {
                    min: 0
                },
                gridlines: {
                    color: 'transparent'
                }
            },
            vAxis: {
                title: 'Temp ' + (recipe.IsMetric ? '(°C)' : '(°F)'),
                titleTextStyle: {
                    italic: false,
                    bold: false
                },
                gridlines: {
                    color: 'transparent'
                }
            },
            colors: ['#ff9500'],
            series: {
                0: {
                    lineWidth: 1
                }
            },
            chartArea: {
                top: 10
            },
            height: 100,
            fontName: 'Montserrat',
            fontSize: '8',
            color: '#333',
            backgroundColor: 'transparent',
            legend: {
                position: 'none'
            }
        }
    };
    return {
        chart: _chart,
        time: chart_data.time,
        chill_time: chart_data.chill_time
    };

};
function getZIngredientChart(ingredients, type) {
    var color_options = ingredients.length == 0
        ? ['#ddd']
        : type == 'hops'
            ? ['#8CFFAF', '#5ADD82', '#3E9758', '#276038', '#193D24', '#2F7444', '#276038']
            : ['#FFD693', '#F5A623', '#A37A36', '#604720', '#392A13', '#785620', '#604720'];
    return {
        type: 'PieChart'
        , data: {
            cols: [
                { id: "Ingredient", label: "Ingredient", type: "string" },
                { id: "Percent", label: "Percent", type: "number" }
            ]
            , rows: getIngredientChartRows(ingredients, type)
        },
        options: {
            fontName: 'Montserrat',
            fontSize: '11pt',
            color: 'transparent',
            height: 100,
            pieHole: .75,
            tooltip: getToolTip(ingredients),
            colors: color_options,
            backgroundColor: 'transparent',
            is3D: false,
            legend: {
                alignment: 'center'
                , position: ingredients.length == 0 ? 'none' : 'bottom', textStyle: { fontName: 'Montserrat', fontSize: '8' }
            },
            chartArea: {
                top: 5
            },
            pieSliceText: 'none'
        }
    }
};

