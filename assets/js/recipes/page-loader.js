
// A shim to copy the recipe GUID from the query string to the element in the DOM
// so the existing app code can use it as normal. Also set the proper URL.
(function () {

    var element = document.getElementById("recipe-vm-app");

    const params = new URLSearchParams(location.search);
    const id = params.get("id");

    element.setAttribute("recipeguid", id);
    element.setAttribute("api", "./data/recipes/" + id + ".json");

})();