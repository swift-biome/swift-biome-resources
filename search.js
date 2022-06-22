const searchbar = document.getElementById('search');
const input     = document.getElementById('search-input');
const output    = document.getElementById('search-results');

var search      = null;
var unloaded    = true; 
var selection   = null;
var pending     = null;

function select(index) {
    output.children.item(selection.index).classList.remove('selected');
    output.children.item(index).classList.add('selected');
    selection.index = index;
}

function reinitialize() {
    if (unloaded === false) {
        if (selection !== null) {
            select(0);
        }
        return; 
    } 
    unloaded = false;
    
    var requests = [];
    for (const uri of searchIndices) {
        requests.push(fetch(uri).then((response) => response.json()));
    }
    
    Promise.all(requests).then(function(json) {
        var symbols = [];
        for (const group of json.flat(1)) {
            const module = group.module;
            for (const symbol of group.symbols) {
                symbols.push({
                    module: module,
                    signature: symbol.s,
                    display: symbol.t,
                    uri: symbol.u
                });
            }
        }
        search = {
            symbols: symbols, 
            index: lunr(function() {
                this.ref('i');
                this.field('text');
                
                // disable stemming 
                this.pipeline.remove(lunr.stemmer);
                this.searchPipeline.remove(lunr.stemmer);
                
                for (let i = 0; i < symbols.length; i++) {
                    this.add({i: i, text: symbols[i].signature});
                }
            })
        };
        if (pending !== null) {
            suggest(pending);
        }
    })
    .catch(function(error) {
        unloaded = true;
        console.error('error:', error);
    });
}
function suggest(event) {
    if (search === null) {
        pending = event;
        return;
    } else {
        pending = null;
    }
    const needle    = event.target.value.toLowerCase();
    
    var results     = undefined;
    if (needle.length > 0) {
        results     = search.index.query(function(query) {
            query.term(needle, { boost: 100});
            query.term(needle, { boost:  10, wildcard: lunr.Query.wildcard.TRAILING });
            query.term(needle, { boost:   5, wildcard: lunr.Query.wildcard.TRAILING, editDistance: 1 });
            query.term(needle, { boost:   1, wildcard: lunr.Query.wildcard.TRAILING, editDistance: 2 });
        });
    } else {
        results     = [];
    }
    
    const best = results.slice(0, 10);
    output.replaceChildren();
    for (const result of best) {
        const symbol    = search.symbols[result.ref];
        
        const item      = document.createElement("li");
        const anchor    = document.createElement("a");
        const display   = document.createElement("span");
        const module    = document.createElement("span");
        
        display.appendChild(document.createTextNode(symbol.display));
        module.appendChild(document.createTextNode(symbol.module));
        
        anchor.appendChild(display);
        anchor.appendChild(module);
        anchor.setAttribute("href", symbol.uri);
        
        item.appendChild(anchor);
        output.appendChild(item);
    }
    if (best.length > 0) {
        selection = {index: null, choices: best};
        select(0);
    } else {
        selection = null;
    }
}
function navigate(event) {
    if (event.keyCode == 38) {
        if (selection === null) {
            return;
        } else if (selection.index > 0) {
            select(selection.index - 1);
            event.preventDefault();
            return false;
        }
    } else if (event.keyCode == 40) {
        if (selection === null) {
            return;
        } else if (selection.index < selection.choices.length - 1) {
            select(selection.index + 1);
            event.preventDefault();
            return false;
        }
    }
}
function follow(event) {
    event.preventDefault();
    if (selection === null) {
        return false;
    }
    window.location.assign(search.symbols[selection.choices[selection.index].ref].uri);
}

input.addEventListener('focus', reinitialize); 
input.addEventListener('input', suggest); 
input.addEventListener('keydown', navigate); 
searchbar.addEventListener('submit', follow); 
