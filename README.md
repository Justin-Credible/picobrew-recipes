# PicoBrew Public Recipe Library Mirror

This is a mirror of the PicoBrew Public Recipe library:

https://www.picobrew.com/PublicRecipes/PublicRecipes

which is available here:

https://justin-credible.github.io/picobrew-recipes/


## Why?

Earlier this year PicoBrew essentially shut down. You can read more details here: https://www.pbfundingllc.com/news

They've been able to keep the servers online so people can finish brewing their PicoPaks, but we're not sure how much longer that will be the case.

The community has been keeping these machines running via a custom server which can run on the Raspberry Pi: https://github.com/chiefwigms/picobrew_pico

This allows people to brew their own custom recipes without the need for the official servers to be online.

As more people get into brewing custom recipes, I thought it would be helpful to have a mirror of the public recipe list in case it also disappears.

This mirror contains a toggle that lets the user view the community submitted recipes alongside the "official PicoBrew Inc." recipes, if they so choose.

Recipes can be exported in the [BeerXML format](http://www.beerxml.com/beerxml.htm) by clicking the Export link at the top of each recipe. The recipes can then be used in other software, such as [Recipe Crafter 2](https://crafter.pilotbatchbrewing.com).

## Development

This contains the recipe lists and recipes in JSON format in the `data` directory.

It also contains HTML/CSS/JS that was from the official site, slightly modified to work with a static file HTTP server.

```
brew install http-server
git clone git@github.com:Justin-Credible/picobrew-recipes.git
cd picobrew-recipes
http-server
```
