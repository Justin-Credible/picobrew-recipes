/* Taken from: https://www.picobrew.com/Scripts/Recipes/RecipeVM-App.js */

if (!String.prototype.encodeHTML) {
    String.prototype.encodeHTML = function () {
        return this.replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&apos;');
    };
}

google.charts.load('current', { packages: ['corechart'] });

var request_params = {
    Set_Load: function (useMetric, recipeGuid) {
        this.Data.UseMetric = useMetric;
        this.Data.RecipeGUID = recipeGuid;
        this.Data.Comment = null;
        this.Data.AddComment = false;
        this.Data.Rating = null;
        this.Data.AddRating = false;
    },
    Set_Add_Comment: function (comment) {
        this.Data.Rating = null;
        this.Data.AddRating = false;
        this.Data.Comment = comment;
        this.Data.AddComment = true;
    },
    Set_Add_Rating: function (rating) {
        this.Data.Rating = rating;
        this.Data.AddRating = true;
        this.Data.Comment = null;
        this.Data.AddComment = false;
    },
    Get: function () {
        return this.Data;
    },
    Data: {
        UseMetric: false,
        RecipeGUID: null,
        Comment: null,
        AddComment: false,
        Rating: null,
        AddRating: false
    }
};

var carb_kegs = ["Ball Lock Keg", "Pico Serving Keg"];

new Vue({
    el: '#recipe-vm-app',
    data: function () {
        return {
            url: '',
            vm: null,
            loaded: false,
            useMetric: false,
            recipe_guid: null,
            params: function () {
                return request_params.Get();
            },
            rating: null,
            comment: null,
            isMobile: false,
            brew_time_est: null,
            chill_time_est: null,
            showStepsAndNotes: false,
            showMachineSteps: false
        }
    },
    computed: {
        GetCreationDate: function() {
            return this.vm && this.vm.Recipe && this.vm.Recipe.CreationDate
                ? new Date(this.vm.Recipe.CreationDate).toLocaleDateString()
                : '';
        },
        HasRating: function (){
            return this.rating && this.rating > 0 && this.rating <= 10;
        },
        HasComment: function () {
            return this.comment && this.comment.replace(/\s/g, '').length > 0;
        },
        IsPublic: function () {
            return this.vm.Recipe.Shared && this.vm.Recipe.Locked
        },
        SRMPic: function () {
            if (!this.vm.Recipe.SRM)
               this.vm.Recipe.SRM = 10
            return GetSmallSRMImage(this.vm.Recipe.SRM)
        }

    },
    mounted: function () {
        const self = this;
        self.recipe_guid = self.$el.attributes.recipeguid.value;
        self.url = self.$el.attributes.api.value;
        self.useMetric = self.$el.attributes.usemetric.value;
        self.isMobile = self.$el.attributes.ismobile.value;
        document.addEventListener("DOMContentLoaded", self.loadVM);
    },
    methods: {
        loadVM: function () {
            const self = this;
            self.loaded = false;
            request_params.Set_Load(self.useMetric, self.recipe_guid);
            self.get_api().then(function (response) {
                self.vm = response.data.VM;
                if (!self.vm.CanAccess) {
                    window.location.replace("/");
                }
                else if (self.vm.RedirectURL != null) {
                    window.location.replace(self.vm.RedirectUR);
                }
                else {
                    self.loaded = true;
                    google.charts.setOnLoadCallback(self.setCharts);
                }
            });
        },
        getStepLocationName: function (location) {
            return this.vm.CompartmentNames.step[location];
        },
        setCharts: function () {
            this.setIngredientChart();
            this.setBrewSimChart();
        },
        setIngredientChart: function() {
            const self = this;
            var boil_hop_data = self.vm.Recipe.Hops;
            var whirlpool_hop_data = self.vm.Recipe.WhirlpoolHops;
            var ferm_data = self.vm.Recipe.Fermentables;
            var hop_data = boil_hop_data.concat(whirlpool_hop_data);
            var hop_dataset_filtered = [];
            // Need to consolidate ingredients that're the same for hops 
            for (var i = 0; i < hop_data.length; i++) {
                var duplicates = hop_dataset_filtered.filter(function (x) {
                    return x.HopID == hop_data[i].HopID;
                });
                if (duplicates.length == 0 && hop_data[i].Amount > 0) {
                    hop_dataset_filtered.push(hop_data[i]);
                }
                else {
                    hop_dataset_filtered.map(function (h) {
                        if (h.HopID == hop_data[i].HopID) {
                            h.Amount += hop_data[i].Amount;
                        }
                    });
                }
            };
            var ferm_chart_data = getZIngredientChart(ferm_data, 'fermentables');
            var hop_chart_data = getZIngredientChart(hop_dataset_filtered, 'hops');

            var hop_chart = new google.visualization.PieChart(document.getElementById('hop_bill_chart'));
            var ferm_chart = new google.visualization.PieChart(document.getElementById('grain_bill_chart'));

            hop_chart.draw(new google.visualization.DataTable(hop_chart_data.data), hop_chart_data.options);
            ferm_chart.draw(new google.visualization.DataTable(ferm_chart_data.data), ferm_chart_data.options);
        },
        printRecipe: function () {
            $('.l-button-container').hide();
            window.print();
            $('.l-button-container').show();
        },
        addComment: function () {
            const self = this;
            request_params.Set_Add_Comment(self.comment);
            self.post_api().then(function (response) {
                self.vm = response.data.VM;
            }, function () {
                $('#all').empty();
                var warning = "Failed to add comment.";
                $('#all').append("<div class=\"alert alert-danger alert-dismissable\"><button type=\"button\" class=\"close\" data-dismiss=\"alert\" aria-hidden=\"true\">&times\;</button>" + warning + "</div>");
            });
        },
        addRating: function () {
            const self = this;
            request_params.Set_Add_Rating(self.rating);
            self.post_api().then(function (response) {
                self.vm = response.data.VM;
            }, function () {
                $('#all').empty();
                var warning = "Failed to add rating.";
                $('#all').append("<div class=\"alert alert-danger alert-dismissable\"><button type=\"button\" class=\"close\" data-dismiss=\"alert\" aria-hidden=\"true\">&times\;</button>" + warning + "</div>");
            });
        },
        // *** API ***
        get_api: function(params) {
            const self = this;
            var _data = params ? params : self.params();
            return new Promise(function (resolve, reject) {
                axios({
                    method: 'get',
                    url: self.url,
                    data: _data,
                    headers: { 'Content-Type': 'application/json' }
                })
                    .then(function (response) {
                        resolve(response);
                    })
                    .catch(function () {
                        reject();
                    });
            });
        },
        post_api: function(params) {
            alert("Not implemented!");
            throw new Error("Not implemented!");
            const self = this;
            var _data = params ? params : self.params();
            return new Promise(function (resolve, reject) {
                axios({
                    method: 'post',
                    url: self.url,
                    data: _data,
                    headers: { 'Content-Type': 'application/json' }
                })
                    .then(function (response) {
                        resolve(response);
                    })
                    .catch(function () {
                        reject();
                    });
            });
        },
        setBrewSimChart: function () {
            const self = this;
            var data = getZBrewSimData(self.vm.Recipe);
            var brew_graph_data = data.chart;

            var brew_graph = new google.visualization.LineChart(document.getElementById('brew_graph'));
            brew_graph.draw(new google.visualization.DataTable(brew_graph_data.data), brew_graph_data.options);

            self.brew_time_est = data.time;
            self.chill_time_est = data.chill_time;
        },
        drawChart: function() {
            const self = this;
            if (self.vm.Recipe.Fermentables.length > 0) {
                var data = new google.visualization.DataTable();
                data.addColumn('string', 'Malt');
                data.addColumn('number', 'Amount' + (self.vm.Recipe.IsMetric ? 'kg' : 'lbs'));
                var options = {
                    fontName: 'Arial',
                    fontSize: '11pt',
                    colors: ['#FAF6B7', '#F0E099', '#C3B363', '#A79F79', '#D2691E', '#A0522D', '#B47F00'],
                    backgroundColor: 'white',
                    is3D: true,
                    legend: { alignment: 'center' },
                    chartArea: { left: 0, top: 10, width: "100%", height: "100%" },
                    pieSliceTextStyle: { color: 'black' }
                };
                if (!self.isMobile) {
                    options['height'] = 186;
                    options['width'] = 420;
                }
                else {
                    options['width'] = 225;
                }
                for (var i = 0; i < self.vm.Recipe.Fermentables.length; i++) {
                    data.addRow([self.vm.Recipe.Fermentables[i].Name, self.vm.Recipe.Fermentables[i].Amount]);
                }

                var chart = new google.visualization.PieChart(document.getElementById('grain_bill_chart'));
                chart.draw(data, options);
            }

        },
        exportRecipe: function() {
            const self = this;
            var blob = new Blob([self.beerXML(self.vm.Recipe)]);
            var link = document.createElement('a');
            link.href = window.URL.createObjectURL(blob);
            link.download = `${self.vm.Recipe.Name.replace(/[^a-zA-Z0-9\ \-\.]/g, '')}.xml`;
            link.click();
            
            // const self = this;
            // axios({
            //     method: 'post',
            //     url: '/z_crafter/json/exportrecipejson',
            //     data: $.param({
            //         recipe: JSON.stringify(self.vm.Recipe)
            //     })
            // }).then(function (response) {
            //     var blob = new Blob([response.data]);
            //     var link = document.createElement('a');
            //     link.href = window.URL.createObjectURL(blob);
            //     link.download = self.vm.Recipe.Name + "_recipe_xml.xml";
            //     link.click();
            // }, function (errMsg) {
            //     alert(errMsg);
            // })
        },
        
        locationName: function(location) {
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
                    return 'Pause'; // 'Ferment'
                default:
                    return 'Mash';
            }
        },

        hopUse: function(location) {
            switch (location) {
                case 1:
                    return 'Mash'; // "First Wort"
                case 2:
                case 3:
                case 4:
                case 5:
                    return 'Boil'; // "Aroma" if at a lower temp?
                default:
                    return 'Dry Hop';
            }
        },

        fermentableType: function(type) {
            switch (type) {
                case 'Grain':
                case 'OtherGrain':
                    return 'Grain';
                case 'DryExtract':
                    return 'Dry Extract';
                case 'Sugar':
                    return 'Sugar';
                
            }
        },
        
        // utility function to convert fahrenheit to celcius 
        fahrenheit_to_celcius: function(temp, decimals=2) {
            let converted_temp;
            converted_temp = (temp - 32) * 5 / 9;
            return Number((converted_temp).toFixed(decimals));
        },
        
        // utility function to convert gallons to liters 
        gallons_to_liters: function(volume, scale = 1) {
            let converted_volume;
            converted_volume = volume * 3.78541 * scale;
            return Number((converted_volume).toFixed(2));
        },

        tbsp_to_liters: function(volume) {
            let converted_volume;
            converted_volume = volume / 67.628;
            return Number((converted_volume).toFixed(10));
        },

        tsp_to_liters: function(volume) {
            let converted_volume;
            converted_volume = volume / 203
            ;
            return Number((converted_volume).toFixed(10));
        },
        
        // utility function to convert pounds to kilograms 
        lb_to_kg: function(weight) {
            let converted_weight;
            converted_weight = weight / 2.205;
            return Number((converted_weight).toFixed(6));
        },

        // utility function to convert ounces to kilogram 
        oz_to_kg: function (weight) {
            let converted_weight;
            converted_weight = weight / 35.274;
            return Number((converted_weight).toFixed(6));
        },

        // utility function to convert gram to kilogram
        g_to_kg: function(weight) {
            let converted_weight;
            converted_weight = weight * 1000;
            return Number((converted_weight).toFixed(3));
        },

        // utility function to convert various amounts from the units provided
        units_to_kg_or_l: function(units="kg", amount) {
            switch (units.toLowerCase()) {
                case "tsp":
                    return this.tsp_to_liters(amount); // convert to liters
                case "tbsp":
                    return this.tbsp_to_liters(amount); // convert to liters
                case "g":
                    return this.g_to_kg(amount); // convert to kg
                case "lbs":
                    return this.lb_to_kg(amount); // convert to kg
                case "oz":
                    return this.oz_to_kg(amount); // convert to kg
                default:
                    return amount;
            }
        },

        amount_is_weight: function(units="kg") {
            if (units == undefined) {
                return true;
            }
            switch (units.toLowerCase()) {
                case "kg":
                case "g":
                case "lbs":
                case "oz":
                    return true;
                case "tbsp":
                case "tsp":
                    return false;
            }
        },

        yeast_form: function(laboratory="Fermentis") {
            switch (laboratory.toLowerCase()) {
                case "white labs":
                case "omega yeast":
                case "gigayeast":
                case "wyeast":
                case "imperial":
                    return "Liquid";
                default:
                    return "Dry";
            }
        },
        
        beerXML: function(recipe) {
            var machineSteps = '';
            for (const el of recipe.MachineSteps) {
                var step = `
                <STEP>
                    <NAME>${el.Name}</NAME>
                    <TEMP>${this.fahrenheit_to_celcius(el.Temperature, 0)}</TEMP>
                    <TIME>${el.Time}</TIME>
                    <LOCATION>${this.locationName(el.StepLocation)}</LOCATION>
                    <DRAIN>${el.Drain}</DRAIN>
                </STEP>
                `;
                machineSteps = machineSteps.concat("\n", step)
            }
        
            var picoExtention = `
            <ZYMATIC>
                <MASH_TIME>${recipe.MashTime}</MASH_TIME>
                <MASH_TEMP>${this.fahrenheit_to_celcius(recipe.MashTemp, 0)}</MASH_TEMP>
                <BOIL_TEMP>${this.fahrenheit_to_celcius(recipe.BoilTemp, 0)}</BOIL_TEMP>
                ${machineSteps}
            </ZYMATIC>
            `;
        
            var mashSteps = '';
            for (const el of recipe.MashSteps) {
                var step = `
                    <MASH_STEP>
                        <NAME>${el.Name}</NAME>
                        <VERSION>1</VERSION>
                        <TYPE>Temperature</TYPE>
                        <STEP_TEMP>${this.fahrenheit_to_celcius(el.Temp, 0)}</STEP_TEMP>
                        <STEP_TIME>${el.Time}</STEP_TIME>
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
            for (const el of recipe.Hops) {
                var hop = `
                    <HOP>
                        <VERSION>1</VERSION>
                        <NAME>${el.Name}</NAME>
                        <ALPHA>${el.Alpha}</ALPHA>
                        <AMOUNT>${this.oz_to_kg(el.Amount)}</AMOUNT>
                        <USE>${this.hopUse(el.Location)}</USE>
                        <TIME>${el.Time}</TIME>
                        <PB_LOCATION>${el.Location}</PB_LOCATION>
                    </HOP>
                `;
                hops = hops.concat("\n", hop)
            }

            for (const el of recipe.DryHops) {
                var hop = `
                    <HOP>
                        <VERSION>1</VERSION>
                        <NAME>${el.Name}</NAME>
                        <ALPHA>${el.Alpha}</ALPHA>
                        <AMOUNT>${this.oz_to_kg(el.Amount)}</AMOUNT>
                        <USE>Dry Hop</USE>
                        <TIME>${el.Time}</TIME>
                        <PB_LOCATION>${el.Location}</PB_LOCATION>
                    </HOP>
                `;
                hops = hops.concat("\n", hop)
            }

            for (const el of recipe.WhirlpoolHops) {
                var hop = `
                    <HOP>
                        <VERSION>1</VERSION>
                        <NAME>${el.Name}</NAME>
                        <ALPHA>${el.Alpha}</ALPHA>
                        <AMOUNT>${this.oz_to_kg(el.Amount)}</AMOUNT>
                        <USE>Aroma</USE>
                        <TIME>${el.Time}</TIME>
                        <PB_LOCATION>${el.Location}</PB_LOCATION>
                    </HOP>
                `;
                hops = hops.concat("\n", hop)
            }

            var adjuncts = '';
            for (const el of recipe.Adjuncts) {
                var adjunct = `
                    <MISC>
                        <VERSION>1</VERSION>
                        <NAME>${el.Name}</NAME>
                        <TYPE>${el.AdjunctType}</TYPE>
                        <AMOUNT>${this.oz_to_kg(el.Amount)}</AMOUNT>
                        <USE>${el.Location && el.Time ? 'Boil' : 'Secondary'}</USE>
                        <TIME>${el.Time}</TIME>
                        <AMOUNT_IS_WEIGHT>true</AMOUNT_IS_WEIGHT>
                        <PB_LOCATION>${el.Location}</PB_LOCATION>
                    </MISC>
                `;
                adjuncts = adjuncts.concat("\n", adjunct)
            }

            // water chemistry
            for (const el of recipe.Amendments) {
                var adjunct = `
                    <MISC>
                        <VERSION>1</VERSION>
                        <NAME>${el.Name} (${el.Description})</NAME>
                        <TYPE>Water Agent</TYPE>
                        <AMOUNT>${this.oz_to_kg(el.Amount)}</AMOUNT>
                        <USE>Boil</USE>
                        <AMOUNT_IS_WEIGHT>true</AMOUNT_IS_WEIGHT>
                        <NOTES>${el.Description}</NOTES>
                        <PB_LOCATION>${el.Location}</PB_LOCATION>
                    </MISC>
                `;
                adjuncts = adjuncts.concat("\n", adjunct)
            }

            // adjuncts in whirlpool
            for (const el of recipe.WhirlpoolAdjuncts) {
                var adjunct = `
                    <MISC>
                        <VERSION>1</VERSION>
                        <NAME>${el.Name}</NAME>
                        <TYPE>${el.AdjunctType}</TYPE>
                        <AMOUNT>${this.oz_to_kg(el.Amount)}</AMOUNT>
                        <USE>Boil</USE>
                        <AMOUNT_IS_WEIGHT>true</AMOUNT_IS_WEIGHT>
                        <PB_LOCATION>${el.Location}</PB_LOCATION>
                    </MISC>
                `;
                adjuncts = adjuncts.concat("\n", adjunct)
            }

            // dry adjuncts (most are fining with irish moss, late addition spice or yeast nutrient)
            for (const el of recipe.DryAdjuncts) {
                var adjunct = `
                    <MISC>
                        <VERSION>1</VERSION>
                        <NAME>${el.Name}</NAME>
                        <TYPE>${el.AdjunctType}</TYPE>
                        <AMOUNT>${el.Units ? this.units_to_kg_or_l(el.Units, el.Amount) : this.oz_to_kg(el.Amount)}</AMOUNT>
                        <USE>Boil</USE>
                        <AMOUNT_IS_WEIGHT>${this.amount_is_weight(el.Units)}</AMOUNT_IS_WEIGHT>
                        <PB_LOCATION>${el.Location}</PB_LOCATION>
                    </MISC>
                `;
                adjuncts = adjuncts.concat("\n", adjunct)
            }
            
        
            var fermentables = '';
            for (const el of recipe.Fermentables) {
                var fermentable = `
                    <FERMENTABLE>
                        <VERSION>1</VERSION>
                        <NAME>${el.Name}</NAME>
                        <AMOUNT>${this.lb_to_kg(el.Amount)}</AMOUNT>
                        <TYPE>${this.fermentableType(el.FermentableType)}</TYPE>
                        <YIELD>${new Number(el.Yield * 2.17391304).toFixed(4)}</YIELD>
                        <COLOR>${el.Color}</COLOR>
                        <PB_LOCATION>${el.Location ? el.Location : 1}</PB_LOCATION>
                    </FERMENTABLE>
                `;
                fermentables = fermentables.concat("\n", fermentable)
            }
        
            var fermentionSteps = '';
            var primaryAge = '', secondaryAge = '', tertiaryAge = '', age = '';
            var primaryTemp = '', secondaryTemp = '', tertiaryTemp = '', temp = '';
            for (const el of recipe.FermentationSteps) {
                var ferm = `
                <STEP>
                    <NUMBER>${el.Step}</NUMBER>
                    <NAME>${el.Name}</NAME>
                    <TIME>${el.Days * 24 * 60}</TIME>
                    <TEMP>${this.fahrenheit_to_celcius(el.Temp, 0)}</TEMP>
                </STEP>
                `;
        
                if (el.Step == 1) {
                    primaryAge = `<PRIMARY_AGE>${el.Days}</PRIMARY_AGE>`
                    primaryTemp = `<PRIMARY_TEMP>${this.fahrenheit_to_celcius(el.Temp, 0)}</PRIMARY_TEMP>`
                }
                if (el.Step == 2 && !el.Name.includes("Chill")) {
                    secondaryAge = `<SECONDARY_AGE>${el.Days}</SECONDARY_AGE>`
                    secondaryTemp = `<SECONDARY_TEMP>${this.fahrenheit_to_celcius(el.Temp, 0)}</SECONDARY_TEMP>`
                }
                if (el.Step == 3 && !el.Name.includes("Chill")) {
                    tertiaryAge = `<TERTIARY_AGE>${el.Days}</TERTIARY_AGE>`
                    tertiaryTemp = `<TERTIARY_TEMP>${this.fahrenheit_to_celcius(el.Temp, 0)}</TERTIARY_TEMP>`
                }
                fermentionSteps = fermentionSteps.concat("\n", ferm);
            }
        
            const creationDate = new Date(recipe.CreationDate);
            const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
            var notes = recipe.Notes ? `<NOTES>${recipe.Notes.encodeHTML()}</NOTES>` : '';
            var tastingNotes = recipe.TastingNotes ? `<TASTE_NOTES>${recipe.TastingNotes.encodeHTML()}</TASTE_NOTES>` : '';
        
            var beerXML = `
                <?xml version="1.0" encoding="iso-8859-1"?>
                <RECIPES>
                    <RECIPE>
                        <VERSION>1</VERSION>
                        <TYPE>All Grain</TYPE>
                        <NAME>${recipe.Name}</NAME>
                        <BREWER>${recipe.Author}</BREWER>
                        ${tastingNotes}
                        <BATCH_SIZE>${this.gallons_to_liters(recipe.BatchSize)}</BATCH_SIZE>
                        <DISPLAY_BATCH_SIZE>${this.gallons_to_liters(recipe.BatchSize)} L (${recipe.BatchSize} gal)</DISPLAY_BATCH_SIZE>
                        <BOIL_SIZE>${this.gallons_to_liters(recipe.H2O, .964)}</BOIL_SIZE>
                        <DISPLAY_BOIL_SIZE>${this.gallons_to_liters(recipe.H2O, .964)} L (${new Number(recipe.H2O * .964).toFixed(2)} gal)</DISPLAY_BOIL_SIZE>
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
                        <PB_RECIPETYPE>1</PB_RECIPETYPE>
                        <PB_MASHTYPE>${recipe.MashType}</PB_MASHTYPE>
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
                                <AMOUNT>${this.gallons_to_liters(recipe.H2O)}</AMOUNT>
                            </WATER>
                        </WATERS>
                        <FERMENTABLES>${fermentables}</FERMENTABLES>
                        <HOPS>${hops}</HOPS>
                        <MISCS>${adjuncts}</MISCS>
                        <YEASTS>
                            <YEAST>
                                <VERSION>1</VERSION>
                                <NAME>${recipe.Yeast.Name}</NAME>
                                <LABORATORY>${recipe.Yeast.Laboratory}</LABORATORY>
                                <AMOUNT>${this.lb_to_kg(1)}</AMOUNT>
                                <FORM>${this.yeast_form(recipe.Yeast.Laboratory)}</FORM>
                                <PRODUCT_ID>${recipe.Yeast.ProductID}</PRODUCT_ID>
                                <MIN_TEMPERATURE>${this.fahrenheit_to_celcius(recipe.Yeast.MinTemp, 0)}</MIN_TEMPERATURE>
                                <MAX_TEMPERATURE>${this.fahrenheit_to_celcius(recipe.Yeast.MaxTemp, 0)}</MAX_TEMPERATURE>
                                <ATTENUATION>${recipe.Yeast.ExpectedAtten}</ATTENUATION>
                                <MIN_ATTENUATION>${recipe.Yeast.MinAtten ? recipe.Yeast.MinAtten : -1}</MIN_ATTENUATION>
                                <MAX_ATTENUATION>${recipe.Yeast.MaxAtten ? recipe.Yeast.MaxAtten : -1}</MAX_ATTENUATION>
                                <PB_LOCATION>6</PB_LOCATION>
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
        },
        
        copyRecipe: function () {
            const self = this;
            $('#all').empty();
		    var warning = "Adding recipe...";
		    $('#all').append("<div class=\"alert alert-info alert-dismissable\"><button type=\"button\" class=\"close\" data-dismiss=\"alert\" aria-hidden=\"true\">&times\;</button>" + warning + "</div>");
            axios({
                method: 'post',
                url: '/z_crafter/json/z_recipe_json',
                data: $.param({
                    recipe: JSON.stringify(self.vm.Recipe)
                    ,option: 'copyRecipe'
                })
            }).then(function () {
			    $('#all').empty();
			    var warning = "Recipe added to personal library.";
			    $('#all').append("<div class=\"alert alert-success alert-dismissable\"><button type=\"button\" class=\"close\" data-dismiss=\"alert\" aria-hidden=\"true\">&times\;</button>" + warning + "</div>");
            }, function () {
                $('#all').empty();
                var warning = "Failed to download recipe.";
                $('#all').append("<div class=\"alert alert-danger alert-dismissable\"><button type=\"button\" class=\"close\" data-dismiss=\"alert\" aria-hidden=\"true\">&times\;</button>" + warning + "</div>");
            });
        },
        shareRecipe: function () {
            const self = this;
            $('#sharerecipe').modal('hide');
            $('#all').empty();
		    var warning = "Attempting to add recipe to library.";
		    $('#all').append("<div class=\"alert alert-info alert-dismissable\"><button type=\"button\" class=\"close\" data-dismiss=\"alert\" aria-hidden=\"true\">&times\;</button>" + warning + "</div>");
            axios({
                method: 'post',
                url: '/z_crafter/json/z_recipe_json',
                data: $.param({
                    recipe: JSON.stringify(self.vm.Recipe)
                    ,option: 'shareRecipe'
                })
            }).then(function () {
                $('#all').empty();
                var warning = "Recipe added to public recipes!";
                $('#all').append("<div class=\"alert alert-success alert-dismissable\"><button type=\"button\" class=\"close\" data-dismiss=\"alert\" aria-hidden=\"true\">&times\;</button>" + warning + "</div>");
                self.vm.Recipe.Shared = true;
            }, function () {
                $('#all').empty();
                var warning = "Failed to share recipe.";
                $('#all').append("<div class=\"alert alert-danger alert-dismissable\"><button type=\"button\" class=\"close\" data-dismiss=\"alert\" aria-hidden=\"true\">&times\;</button>" + warning + "</div>");
            });
        },
        deleteRecipe: function () {
            const self = this;
            $('#deleterecipe').modal('hide');
            $('#delmsg').empty();
            var warning = "Attempting to delete recipe.";
            $('#delmsg').append("<div class=\"alert alert-info alert-dismissable\"><button type=\"button\" class=\"close\" data-dismiss=\"alert\" aria-hidden=\"true\">&times\;</button>" + warning + "</div>");
            $.ajax({
                type: "POST",
                url: "/Json/deleterecipe.cshtml",
                data: {
                    guid: self.vm.Recipe.GUID
                },
                success: function (stuff) {
                    var returned = stuff.toString();
                    var success = returned.indexOf("success");
                    if (success < 0) {
                        $('#delmsg').empty();
                        var warning = "Failed to delete recipe." + returned;
                        $('#delmsg').append("<div class=\"alert alert-danger alert-dismissable\"><button type=\"button\" class=\"close\" data-dismiss=\"alert\" aria-hidden=\"true\">&times\;</button>" + warning + "</div>");
                        $("#deleteConfirmButton").show();
                    }
                    else {
                        window.location.href = "/z_crafter/z_recipes.cshtml";
                    }
                }
            });
        },
        UseAsBaseRecipe: function () {
            const self = this;
            $('#all').empty();
            var warning = "Creating base recipe...";
            $('#all').append("<div class=\"alert alert-info alert-dismissable\"><button type=\"button\" class=\"close\" data-dismiss=\"alert\" aria-hidden=\"true\">&times\;</button>" + warning + "</div>");
            $("#copyButton").hide();
            $("#copyButton2").hide();
            $.ajax({
                type: "POST",
                url: "/Z_Crafter/JSON/Z_Recipe_JSON",
                data: {
                    option: 'cloneRecipeFromBaseRecipe',
                    guid: self.vm.Recipe.GUID
                },
                success: function (response) {
                    var json_recipe = response;
                    $('#all').empty();
                    var warning = "Base recipe created! Opening in crafter..";
                    $('#all').append("<div class=\"alert alert-success alert-dismissable\"><button type=\"button\" class=\"close\" data-dismiss=\"alert\" aria-hidden=\"true\">&times\;</button>" + warning + "</div>");
                    var form = document.createElement('form');
                    form.method = "post";
                    form.action = "/Z_Crafter/Z_Recipe";
                    var xml_recipe_field = document.createElement('input');
                    xml_recipe_field.type = 'hidden';
                    xml_recipe_field.name = "xml_recipe";
                    xml_recipe_field.value = json_recipe;
                    form.appendChild(xml_recipe_field);
                    document.body.appendChild(form);
                    form.submit();
                },
                error: function (errorMsg) {
                    $('#all').empty();
                    $('#all').append("<div class=\"alert alert-danger alert-dismissable\"><button type=\"button\" class=\"close\" data-dismiss=\"alert\" aria-hidden=\"true\">&times\;</button>" + errorMsg.responseText + "</div>");
                }
            });
        },
        edit: function () {
            window.location.href = "/Z_Crafter/Z_Recipe.cshtml?guid=" + this.vm.Recipe.GUID;
        }

    }
});
