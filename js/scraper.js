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

  var results, companies, counter, curStr;
  results = [];
  companies = $('.row.result').find('span[class="company"]');
  seen = {};
  if (companies.length > 0) { // companies are found
    companies.findDeepest().each( function() {
      curStr = $(this).text().trim();
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