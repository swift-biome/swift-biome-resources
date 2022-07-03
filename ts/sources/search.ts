import * as lunr from "lunr"

declare const searchIndices:string[];

interface Symbol {
    module:string;
    signature:string[];
    display:string;
    uri:string;
}
interface Culture {
    module:string;
    symbols:{s:string[], t:string, u:string}[];
}

class SearchResults {
    index:number;
    choices:lunr.Index.Result[];

    constructor(choices:lunr.Index.Result[]) {
        this.index = 0;
        this.choices = choices;
    }

    highlight(output:HTMLElement) {
        const item:Element | null = output.children.item(this.index);
        if (item instanceof HTMLElement) {
            item.classList.add('selected');
        }
    }
    rehighlight(output:HTMLElement, index:number) {
        if (index == this.index) {
            return;
        }
        
        const item:Element | null = output.children.item(this.index);
        if (item instanceof HTMLElement) {
            item.classList.remove('selected');
            if (item.classList.length == 0) {
                item.removeAttribute('class');
            }
            
            this.index = index;
            this.highlight(output);
        }
    }
}

class SearchIndex {
    index:lunr.Index;
    symbols:Symbol[];
    
    constructor(symbols:Symbol[]) {
        this.symbols = symbols;
        this.index = lunr(function() {
            this.ref('i');
            this.field('text');
            
            // disable stemming 
            this.pipeline.remove(lunr.stemmer);
            this.searchPipeline.remove(lunr.stemmer);

            for (let i = 0; i < symbols.length; i++) {
                this.add({i: i, text: symbols[i].signature});
            }
        });
    }
    
    search(needle:string):SearchResults | undefined {
        let results:lunr.Index.Result[];
        if (needle.length > 0) {
            results = this.index.query(function(query:lunr.Query) {
                query.term(needle, { boost: 100});
                query.term(needle, { boost:  10, wildcard: lunr.Query.wildcard.TRAILING });
                query.term(needle, { boost:   5, wildcard: lunr.Query.wildcard.TRAILING, editDistance: 1 });
                query.term(needle, { boost:   1, wildcard: lunr.Query.wildcard.TRAILING, editDistance: 2 });
            });
        } else {
            results = [];
        }
        if (results.length > 0) {
            return new SearchResults(results.slice(0, 10));
        } else {
            return undefined
        }
    }
}

class SearchTool {
    output:HTMLElement;
    
    index?:SearchIndex;
    loading:boolean;
    
    pending?:Event;
    results?:SearchResults;
    
    constructor(output:HTMLElement) {
        this.output = output;
        this.loading = false;
    }
    
    async reinitialize() {
        if (this.loading || this.index !== undefined) {
            return; 
        } 
        this.loading = true;

        let requests:Promise<Culture[]>[] = [];
        for (const uri of searchIndices) {
            requests.push(fetch(uri).then(
                (response:Response):Promise<Culture[]> => response.json()));
        }
        this.index = await Promise.all(requests)
            .then(function(nations:Culture[][]):SearchIndex {
                let symbols:Symbol[] = [];
                for (const nation of nations) {
                    for (const culture of nation) {
                        const module:string = culture.module;
                        for (const symbol of culture.symbols) {
                            symbols.push({
                                module: module,
                                signature: symbol.s,
                                display: symbol.t, 
                                uri: symbol.u
                            });
                        }
                    }
                }
                return new SearchIndex(symbols);
            })
            .catch(function(error:Error):undefined {
                console.error('error:', error);
                return undefined;
            });
        this.loading = false;
        if (this.pending !== undefined) {
            this.suggest(this.pending);
        }
    }
    
    suggest(event:Event) {
        if (this.index === undefined) {
            this.pending = event;
            return;
        } else {
            this.pending = undefined;
        }
        // *not* current target, as that will not work for pending events
        const input:HTMLInputElement = event.target as HTMLInputElement;
        this.results = this.index.search(input.value.toLowerCase());
        if (this.results === undefined) {
            return;
        }
        
        let items:HTMLElement[] = [];
        for (const result of this.results.choices) {
            const symbol:Symbol = this.index.symbols[parseInt(result.ref)];
        
            const item:HTMLElement = document.createElement("li");
            const anchor:HTMLElement = document.createElement("a");
            const display:HTMLElement = document.createElement("span");
            const module:HTMLElement = document.createElement("span");
        
            display.appendChild(document.createTextNode(symbol.display));
            module.appendChild(document.createTextNode(symbol.module));
        
            anchor.appendChild(display);
            anchor.appendChild(module);
            anchor.setAttribute('href', symbol.uri);
        
            item.appendChild(anchor);
            items.push(item);
        }
        this.output.replaceChildren(...items);
        this.results.highlight(this.output);
    }
    
    navigate(event:KeyboardEvent) {
        if (this.results === undefined) {
            return;
        }
        switch (event.key) {
            case 'ArrowUp': {
                if (this.results.index > 0) {
                    this.results.rehighlight(this.output, this.results.index - 1);
                    event.preventDefault();
                }
                break;
            }
            case 'ArrowDown': {
                if (this.results.index < this.results.choices.length - 1) {
                    this.results.rehighlight(this.output, this.results.index + 1);
                    event.preventDefault();
                }
                break;
            }
            default: 
                break;
        }
    }
    
    follow(event:Event) {
        event.preventDefault();
        if (this.results === undefined || this.index === undefined) {
            return;
        }
        const choice:lunr.Index.Result = this.results.choices[this.results.index];
        window.location.assign(this.index.symbols[parseInt(choice.ref)].uri);
    }
}

const input:HTMLElement | null = document.getElementById('search-input');
const output:HTMLElement | null = document.getElementById('search-results');
const search:HTMLElement | null = document.getElementById('search');

if (input !== null && 
    output !== null && 
    search !== null) {
    
    const tool = new SearchTool(output);
    
    input.addEventListener('focus', () => tool.reinitialize()); 
    input.addEventListener('input', (event:Event) => tool.suggest(event)); 
    input.addEventListener('keydown', (event:KeyboardEvent) => tool.navigate(event)); 
    
    search.addEventListener('submit', (event:Event) => tool.follow(event)); 
}
