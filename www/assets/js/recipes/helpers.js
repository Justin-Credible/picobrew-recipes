
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

function locationName(location) {
    switch (location) {
        case 0:
            return 'PassThrough';
        case 1:
            return 'Mash';
        case 2:
            return 'Adjunct1';
        case 3:
            return 'Adjunct2';
        case 4:
            return 'Adjunct3';
        case 5:
            return 'Adjunct4';
        case 6:
            return 'Pause';
    }
}

// utility function to convert fahrenheit to celcius 
function fahrenheit_to_celcius(temp, decimals=2) {
    let converted_temp;
    converted_temp = (temp - 32) * 5 / 9;
    return Number((converted_temp).toFixed(decimals));
}

// utility function to convert gallons to liters 
function gallons_to_liters(volume, scale = 1) {
    let converted_volume;
    converted_volume = volume * 3.78541 * scale;
    return Number((converted_volume).toFixed(2));
}

// utility function to convert gallons to liters 
function lb_to_kg(weight) {
    let converted_weight;
    converted_weight = weight / 2.205;
    return Number((converted_weight).toFixed(2));
}

// utility function to convert gallons to liters 
function oz_to_g(weight) {
    let converted_weight;
    converted_weight = weight / 28.35;
    return Number((converted_weight).toFixed(2));
}

function beerXML(recipe) {
    var machineSteps = '';
    for (const s of recipe.MachineSteps) {
        var step = `
        <STEP>
            <NAME>${s.Name}</NAME>
            <TEMP>${fahrenheit_to_celcius(s.Temperature, 0)}</TEMP>
            <TIME>${s.Time}</TIME>
            <LOCATION>${locationName(s.StepLocation)}</LOCATION>
            <DRAIN>${s.Drain}</DRAIN>
        </STEP>
        `;
        machineSteps = machineSteps.concat("\n", step)
    }

    var picoExtention = `
    <ZYMATIC>
        <MASH_TIME>${recipe.MashTime}</MASH_TIME>
        <MASH_TEMP>${fahrenheit_to_celcius(recipe.MashTemp, 0)}</MASH_TEMP>
        <BOIL_TEMP>${fahrenheit_to_celcius(recipe.BoilTemp, 0)}</BOIL_TEMP>
        <STEPS>${machineSteps}</STEPS>
    </ZYMATIC>
    `;

    var mashSteps = '';
    for (const s of recipe.MashSteps) {
        var step = `
            <MASH_STEP>
                <NAME>${s.Name}</NAME>
                <VERSION>1</VERSION>
                <TYPE>Temperature</TYPE>
                <STEP_TEMP>${fahrenheit_to_celcius(s.Temp)}</STEP_TEMP>
                <STEP_TIME>${s.Time}</STEP_TIME>
            </MASH_STEP>
        `;
        mashSteps = mashSteps.concat("\n", step)
    }
    // 22.22222 = ambient room temp ~71 F
    var mashProfile = `
    <MASH>
        <NAME>Custom</NAME>
        <VERSION>1</VERSION>
        <GRAIN_TEMP>22.22222</GRAIN_TEMP>
        <MASH_STEPS>
            ${mashSteps}
        </MASH_STEPS>
    </MASH>
    `;

    var hops = '';
    for (const h of recipe.Hops) {
        var hop = `
            <HOP>
                <VERSION>1</VERSION>
                <NAME>${h.Name}</NAME>
                <ALPHA>${h.Alpha}</ALPHA>
                <AMOUNT>${oz_to_g(h.Amount)}</AMOUNT>
                <USE>${h.BoilUse ? 'Boil' : 'Dry Hop'}</USE>
                <TIME>${h.Time}</TIME>
            </HOP>
        `;
        hops = hops.concat("\n", hop)
    }

    var fermentables = '';
    for (const f of recipe.Fermentables) {
        var fermentable = `
            <FERMENTABLE>
                <VERSION>1</VERSION>
                <NAME>${f.Name}</NAME>
                <AMOUNT>${lb_to_kg(f.Amount)}</AMOUNT>
                <TYPE>${f.FermentableType}</TYPE>
                <YIELD>${f.Yield}</YIELD>
                <COLOR>${f.Color}</COLOR>
            </FERMENTABLE>
        `;
        fermentables = fermentables.concat("\n", fermentable)
    }

    var fermentionSteps = '';
    var primaryAge = '', secondaryAge = '', tertiaryAge = '', age = '';
    var primaryTemp = '', secondaryTemp = '', tertiaryTemp = '', temp = '';
    for (const s of recipe.FermentationSteps) {
        var ferm = `
        <STEP>
            <NUMBER>${s.Step}</NUMBER>
            <NAME>${s.Name}</NAME>
            <TIME>${s.Days * 24 * 60}</TIME>
            <TEMP>${fahrenheit_to_celcius(s.Temp)}</TEMP>
        </STEP>
        `;

        if (s.Step == 1) {
            primaryAge = `<PRIMARY_AGE>${s.Days}</PRIMARY_AGE>`
            primaryTemp = `<PRIMARY_TEMP>${fahrenheit_to_celcius(s.Temp)}</PRIMARY_TEMP>`
        }
        if (s.Step == 2 && !s.Name.includes("Chill")) {
            secondaryAge = `<SECONDARY_AGE>${s.Days}</SECONDARY_AGE>`
            secondaryTemp = `<SECONDARY_TEMP>${fahrenheit_to_celcius(s.Temp)}</SECONDARY_TEMP>`
        }
        if (s.Step == 3 && !s.Name.includes("Chill")) {
            tertiaryAge = `<TERTIARY_AGE>${s.Days}</TERTIARY_AGE>`
            tertiaryTemp = `<TERTIARY_TEMP>${fahrenheit_to_celcius(s.Temp)}</TERTIARY_TEMP>`
        }
        fermentionSteps = fermentionSteps.concat("\n", ferm);
    }

    const creationDate = new Date(recipe.CreationDate);
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    var notes = recipe.Notes ? `<NOTES>${recipe.Notes}</NOTES>` : '';
    var tastingNotes = recipe.TastingNotes ? `<TASTE_NOTES>${recipe.TastingNotes}</TASTE_NOTES>` : '';

    var beerXML = `
        <?xml version="1.0" encoding="iso-8859-1"?>
        <RECIPES>
            <RECIPE>
                <VERSION>1</VERSION>
                <TYPE>All Grain</TYPE>
                <NAME>${recipe.Name}</NAME>
                <BREWER>${recipe.Author}</BREWER>
                ${tastingNotes}
                <BATCH_SIZE>${gallons_to_liters(recipe.BatchSize)}</BATCH_SIZE>
                <DISPLAY_BATCH_SIZE>${gallons_to_liters(recipe.BatchSize)} L (${recipe.BatchSize} gal)</DISPLAY_BATCH_SIZE>
                <BOIL_SIZE>${gallons_to_liters(recipe.H2O, .964)}</BOIL_SIZE>
                <DISPLAY_BOIL_SIZE>${gallons_to_liters(recipe.H2O, .964)} L (${new Number(recipe.H2O * .964).toFixed(2)} gal)</DISPLAY_BOIL_SIZE>
                <BOIL_TIME>${recipe.BoilTime}</BOIL_TIME>
                <EFFICIENCY>${recipe.Efficiency}</EFFICIENCY>
                <DATE>${creationDate.toLocaleDateString(navigator.language, options).concat(" ", creationDate.toLocaleTimeString(navigator.language))}</DATE>
                <OG>${recipe.OG}</OG>
                <EST_OG>${recipe.OG}</EST_OG>
                <FG>${recipe.FG}</FG>
                <EST_FG>${recipe.FG}</EST_FG>
                <IBU>${recipe.IBU}</IBU>
                <COLOR>${recipe.SRM}</COLOR>
                <EST_COLOR>${recipe.SRM}</EST_COLOR>
                <ABV>${recipe.ABV}</ABV>
                <EST_ABV>${recipe.ABV}</EST_ABV>
                <STYLE>
                    <VERSION>1</VERSION>
                    <CATEGORY_NUMBER>${recipe.BeerStyle.CatNumCode}</CATEGORY_NUMBER>
                    <STYLE_LETTER>${recipe.BeerStyle.CatLettCode}</STYLE_LETTER>
                    <NAME>${recipe.BeerStyle.StyleNameCode}</NAME>
                    <STYLE_GUIDE>${recipe.BeerStyle.StyleGuide}</STYLE_GUIDE>
                    <OG_MIN>${recipe.BeerStyle.MinOG}</OG_MIN>
                    <OG_MAX>${recipe.BeerStyle.MaxOG}</OG_MAX>
                    <FG_MIN>${recipe.BeerStyle.MinFG}</FG_MIN>
                    <FG_MAX>${recipe.BeerStyle.MaxFG}</FG_MAX>
                    <IBU_MIN>${recipe.BeerStyle.MinIBU}</IBU_MIN>
                    <IBU_MAX>${recipe.BeerStyle.MaxIBU}</IBU_MAX>
                    <COLOR_MIN>${recipe.BeerStyle.MinSRM}</COLOR_MIN>
                    <COLOR_MAX>${recipe.BeerStyle.MaxSRM}</COLOR_MAX>
                </STYLE>
                <EQUIPMENT>
                    <NAME>PicoBrew Z/Zymatic</NAME>
                    <VERSION>1</VERSION>
                </EQUIPMENT>
                ${notes}
                ${picoExtention}
                ${mashProfile}
                <WATERS>
                    <WATER>
                        <VERSION>1</VERSION>
                        <AMOUNT>${gallons_to_liters(recipe.H2O)}</AMOUNT>
                    </WATER>
                </WATERS>
                <FERMENTABLES>${fermentables}</FERMENTABLES>
                <HOPS>${hops}</HOPS>
                <YEASTS>
                    <YEAST>
                        <VERSION>1</VERSION>
                        <NAME>${recipe.Yeast.Name}</NAME>
                        <LABORATORY>${recipe.Yeast.Laboratory}</LABORATORY>
                        <AMOUNT>1</AMOUNT>
                        <FORM>Dry</FORM>
                        <PRODUCT_ID>${recipe.Yeast.ProductID}</PRODUCT_ID>
                        <MIN_TEMPERATURE>${fahrenheit_to_celcius(recipe.Yeast.MinTemp)}</MIN_TEMPERATURE>
                        <MAX_TEMPERATURE>${fahrenheit_to_celcius(recipe.Yeast.MaxTemp)}</MAX_TEMPERATURE>
                        <ATTENUATION>${recipe.Yeast.ExpectedAtten}</ATTENUATION>
                    </YEAST>
                </YEASTS>
                <FERMENTATION_STAGES>${recipe.FermentationSteps.length}</FERMENTATION_STAGES>
                ${primaryAge}
                ${primaryTemp}
                ${secondaryAge}
                ${secondaryTemp}
                ${tertiaryAge}
                ${tertiaryTemp}
                <KEGSMART>
                    <STEPS>${fermentionSteps}</STEPS>
                </KEGSMART>
            </RECIPE>
        </RECIPES>
    `;

    return beerXML;
}
