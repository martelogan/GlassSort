$.fn.findDeepest = function() {
    var results = [];
    this.each(function() {
        var deepLevel = 0;
        var deepNode = this;
        treeWalkFast(this, function(node, level) {
            if (level > deepLevel) {
                deepLevel = level;
                deepNode = node;
            }
        });
        results.push(deepNode);
    });
    return this.pushStack(results);
};

/*
#########################################################################################################################
####### TREEWALK ALGORITHM ##############################################################################################
####### credit to jfriend00 #############################################################################################
http://stackoverflow.com/questions/19259029/using-jquery-is-there-a-way-to-find-the-farthest-deepest-or-most-nested-child
#########################################################################################################################
#########################################################################################################################
*/

var treeWalkFast = (function() {
    // create closure for constants
    var skipTags = {"SCRIPT": true, "IFRAME": true, "OBJECT": true, "EMBED": true};
    return function(parent, fn, allNodes) {
        var node = parent.firstChild, nextNode;
        var level = 1;
        while (node && node != parent) {
            if (allNodes || node.nodeType === 1) {
                if (fn(node, level) === false) {
                    return(false);
                }
            }
            // if it's an element &&
            //    has children &&
            //    has a tagname && is not in the skipTags list
            //  then, we can enumerate children
            if (node.nodeType === 1 && node.firstChild && !(node.tagName && skipTags[node.tagName])) {                
                node = node.firstChild;
                ++level;
            } else if (node.nextSibling) {
                node = node.nextSibling;
            } else {
                // no child and no nextsibling
                // find parent that has a nextSibling
                --level;
                while ((node = node.parentNode) != parent) {
                    if (node.nextSibling) {
                        node = node.nextSibling;
                        break;
                    }
                    --level;
                }
            }
        }
    }
})();

// scrape company name strings from HTML
var getCompanyNames = function(HTML) {

  var url, results, companies, counter, curStr, indxCom;
  // adapt scraping to active chrome tab
  url = window.location.href;
  if (url.includes("indeed.com")) {
    console.log("Scraping: indeed.com");
    companies = $('.row.result').find('span[class="company"]');
  }
  else if (url.includes("myfuture.mcgill.ca")) {
    console.log("Scraping: myfuture.mcgill.ca");
    if(url.includes("careerfairs")) {
        companies = $('li.company').find('div[class="list-item-main"]').find('h2 > a[class="ng-binding"]');
    }
    else {
        companies = $('.list-data-columns').find('a[class="ListPrimaryLink"]');
    }
  }
  else if (url.includes("linkedin.com/jobs")) {
    console.log("Scraping: linkedin.com/jobs");
    companies = $('h4.job-card__company-name');
  }
  else if (url.includes("monster")) {
    console.log("Scraping: monster");
    companies = $('div.company');
  }
  else if (url.includes("simplyhired")) {
    console.log("Scraping: simplyhired");
    companies = $('.serp-subtitle').find('span[class="serp-company"][itemprop="name"]');
  }
  else if (url.includes("eluta")) {
    console.log("Scraping: eluta");
    companies = $('.organic-job').find('.employer.lk-employer');
  }
  
  results = [];
  seen = {};
  // parse companies text to list
  if (companies.length > 0) { // companies are found
    companies.findDeepest().each( function() {
      // trim whitespace at string boundaries
      curStr = $(this).text().trim();
      // remove text following comma (inclusive)
      indxCom = curStr.indexOf(',');
      curStr = curStr.substring(0, indxCom != -1 ? indxCom : curStr.length);
      // only add strings we have not yet seen
      if(seen[curStr] !== 1) {
        seen[curStr] = 1;
        results.push(curStr);
      }
    });
  }
  return results;
}

// return results to chrome extension
chrome.extension.sendMessage({
    action: "getCompanyNames",
    source: getCompanyNames(document)
});
