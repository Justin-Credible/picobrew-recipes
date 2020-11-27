/* Taken from: https://www.picobrew.com/Scripts/Recipes/RecipeVM-App.js */

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
            self.post_api().then(function (response) {
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
        post_api: function(params) {
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
            axios({
                method: 'post',
                url: '/z_crafter/json/exportrecipejson',
                data: $.param({
                    recipe: JSON.stringify(self.vm.Recipe)
                })
            }).then(function (response) {
                var blob = new Blob([response.data]);
                var link = document.createElement('a');
                link.href = window.URL.createObjectURL(blob);
                link.download = self.vm.Recipe.Name + "_recipe_xml.xml";
                link.click();
            }, function (errMsg) {
                alert(errMsg);
            })

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




