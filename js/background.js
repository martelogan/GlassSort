// global variable to track execution environment
glassSortExecutionIsChromeExtension = true;
try { // chrome extension execution
  chrome.extension.onMessage.addListener(function(request, sender) {
    if (request.action == "getCompanyNames") { 
      companies = request.source;
      // fill query field if company names were scraped
      var i, queryField;
      queryField = $('#query');
      query_str = queryField.text()
      if (companies.length > 0) { // companies found
        for(i = 0; i < companies.length - 1; i++) {
          query_str += companies[i] + ', ';
        }
        query_str += companies[companies.length - 1];
      }
      queryField.text(query_str);
    }
  });
}
catch(err) { // not a chrome extension
  console.log("Executing outside extension environment.")
  glassSortExecutionIsChromeExtension = false;
}

// configure DOM state (event handlers, etc.)
$(document).ready(function() {
    var query, metric, queryField, submitBtn, backBtn;
    queryField = $('#query');
    submitBtn = $("form.search");
    backBtn = $('#backBtn');
    downloadBtn = $('#downloadBtn');
    queryField.focus();
    submitBtn.submit(function() {
      query = queryField.val().split(',');
      if(query.length == 0 || query[0] == '') {
        return false;
      }
      metric = $('#metric').find(":selected").val();
      showResults(query, metric);
      return false;
    });
    backBtn.click(function() {location.reload()});
    downloadBtn.click(function() {download()});
    $(document).keydown(function(e) {
      if (e.which === 13) {
        e.preventDefault();
        submitBtn.submit();
      }
    });
    $(document).keydown(function(e) {
      if (e.which === 8 && backBtn.is(':visible')) {
        e.preventDefault();
        backBtn.click();
      }
    });
    try { //chrome extension
      // inject scraper script to find companies
      chrome.tabs.executeScript(null, {
        file: "js/jquery-3.1.1.min.js"
      }, function() {
        // If you try and inject into an extensions page or the webstore/NTP you'll get an error
        if (chrome.extension.lastError) {
          console.log('There was an error injecting script : \n' + chrome.extension.lastError.message);
        }
        else {
          chrome.tabs.executeScript(null, {
            file: "js/scraper.js"
          });
        }
      });
    }
    catch(err) { // not a chrome extension
      glassSortExecutionIsChromeExtension = false;
    }
});

// automated saveAs HTML
var download = function() {
  var a = document.body.appendChild(
      document.createElement("a")
  );
  a.download = "results.html";
  a.href = "data:text/html," + document.getElementById("results").innerHTML;
  a.click();
}

// REST call to get user's ip
var getIp = function() {
  var promise = $.Deferred();
  $.ajax({
    url: "http://ipinfo.io/json",
    type: 'get',
    success: function(result) {
      promise.resolve(result.ip);
    }
  });
  return promise;
}

// construct payload to Glassdoor API
var getParams = function() {
  var promise = $.Deferred();
  $.when(
    getIp()
  ).then(function(ip){
      var data = ({
        v : "1",
        format : "json",
        "t.p" : "51706",
        "t.k" : "xBpFKWDKEM",
        userip: ip,
        useragent: navigator.userAgent,
        action: "employers"
      });
      promise.resolve(data);
  });
  return promise;
}

// closures to chain similar ajax requests
var getCompaniesAjaxLambda = function(url, dataType) {
  return function(params, succCallback, errCallback) {
    return function() {
      return $.ajax({
        url: url,
        type: "get",
        data: params,
        dataType: dataType,
        success: function(JSON) {
          succCallback(JSON);
        },
        error: function(XMLHttpRequest, textStatus, errorThrown) { 
          errCallback(XMLHttpRequest, textStatus, errorThrown);
        }        
      });
    };
  };
}

// getCompanies implementation definition
if (glassSortExecutionIsChromeExtension) { // sequential (longer wait time)
  var getCompaniesJSON = function(url, query, params, dataType, globalErrCallback, promise) {
    var results = [], deferreds = [], templateCompaniesAjaxLambda, templateAjax_arr = [];
    // simple closure retaining url and dataType in constructing ajax call
    templateCompaniesAjaxLambda = getCompaniesAjaxLambda(url, dataType);

    // closures to construct specific ajax requests
    var templateAjaxLambda = function(params) {
      return function(succCallback, errCallback) {
        return templateCompaniesAjaxLambda(params, succCallback, errCallback);
      };
    }

    var cur_params, delay, delay_factor, gt4, length;
    query.forEach(function(companyName) { // for each company
      // deep copy generic json request payload
      cur_params = jQuery.extend(true, {}, params);
      // customize payload to this company
      cur_params.q = companyName;
      // store constructed closure for incomplete ajax request
      templateAjax_arr.push(templateAjaxLambda(cur_params))
    });

    // adapt delay to query cardinality
    length = templateAjax_arr.length;
    switch(length % 2) {
      case (0 || 1):
          delay = 100;
          break;
      case 2:
          delay = 500;
          break;
      case 3:
          delay = 1000;
          break;
      default:
          delay_factor = (length % 10) + 1;
          delay = 1000 * delay_factor;
    }

    // base case success callback (promise resolved)
    var finalSuccCallback = function(JSON) {
      results.push(JSON.response.employers[0]);
      promise.resolve(results);
    }

    // base case error callback (promise resolved anyway)
    var finalErrCallback = function(XMLHttpRequest, textStatus, errorThrown) {
      globalErrCallback(XMLHttpRequest, textStatus, errorThrown);
      promise.resolve(results);
    }

    // closure to construct recursive success callback
    var constructSuccCallback = function(nextCallback) {
      return function(JSON) {
        results.push(JSON.response.employers[0]);
        setTimeout(nextCallback, delay);
      };
    }

    // closure to construct recursive error callback
    var constructErrCallback = function(nextCallback) {
      return function(XMLHttpRequest, textStatus, errorThrown) {
        try {
          globalErrCallback(XMLHttpRequest, textStatus, errorThrown);
          setTimeout(nextCallback, delay);
        }
        catch(err) {
          console.log("FATAL ERROR: exiting callback chain.")
        }
      };
    }

    // construct callback chain starting from final ajax call
    var rootAjax, cur_templateAjax, nextCallback, curSuccCallback, curErrCallback;
    cur_templateAjax = templateAjax_arr[templateAjax_arr.length - 1];
    nextCallback = cur_templateAjax(finalSuccCallback, finalErrCallback);
    if (templateAjax_arr.length > 1) {
      for (i = templateAjax_arr.length - 2; i > 0; i--) {
        cur_templateAjax = templateAjax_arr[i];
        curSuccCallback = constructSuccCallback(nextCallback);
        curErrCallback = constructErrCallback(nextCallback);
        nextCallback = cur_templateAjax(curSuccCallback, curErrCallback);
      }
      cur_templateAjax = templateAjax_arr[0];
      curSuccCallback = constructSuccCallback(nextCallback);
      curErrCallback = constructErrCallback(nextCallback);
      rootAjax = cur_templateAjax(curSuccCallback, curErrCallback);
    }
    else {
      rootAjax = nextCallback;
    }

    // initiate callback chain starting at root
    rootAjax();

    return promise;
  }
} 
else { // asynchronous (prone to API blocking)
  var getCompaniesJSON = function(url, query, params, dataType, errCallback, promise) {
    var results = [], deferreds = [];

    // for each company, asynchronously request data
    query.forEach(function(companyName){
      params.q = companyName;
      deferreds.push(
        $.ajax({
          url: url,
          type: "get",
          data: params,
          dataType: dataType,
          success: function(JSON) {results.push(JSON.response.employers[0])},
          error: function(XMLHttpRequest, textStatus, errorThrown) { 
            errCallback()
          }        
        })
      );
    });

    // resolve promise when all requests are realized    
    $.when.apply($, deferreds).then(function() {
      promise.resolve(results);
    });

    return promise;
  }
}

// sort ratings by chosen metric
var glassSort = function(companies, metric) {
  var head, body, tail;
  head = "https://www.glassdoor.ca/Reviews/";
  body = "-Reviews-E";
  tail = ".htm";
  
  if(companies.length == 1) {
    var a = companies[0];
    a.url = head + a.name + body + a.id + tail;
    return companies;
  }

  if(metric != "overallRating") {
    var num1, num2;
    companies.sort(function(a, b){
      if(a.url == null) {
        a.url = head + a.name + body + a.id + tail;
      }
      if(b.url == null) {
        b.url = head + b.name + body + b.id + tail;
      }
      num1 = parseFloat(a[""+ metric]);
      num2 = parseFloat(b[""+ metric]);
      if(num1 > num2) {
        return -1;
      }
      if(num1 < num2) {
        return 1;
      }
      return 0;
    });
  }

  else { // metric is overall rating
    companies.sort(function(a, b){
      if(a.url == null) {
        a.url = head + a.name + body + a.id + tail;
      }
      if(b.url == null) {
        b.url = head + b.name + body + b.id + tail;
      }
      if(a[""+ metric] > b[""+ metric]) {
        return -1;
      }
      if(a[""+ metric] < b[""+ metric]) {
        return 1;
      }
      return 0;
    });
  }
  return companies;
}

// display results of glassSorted companies
var showResults = function (query, metric) {
  var url, el, i, cur, len, allCompaniesSuccess, waitApology, originalPromise, secondChance, jsonFailed, getCompaniesFailed;
  url = "http://api.glassdoor.com/api/api.htm";
  $('#prompt').hide();
  // load time ux management
  $('#loading').show();
  if(glassSortExecutionIsChromeExtension) {
    $('#waitWarning').delay(1500).show(0);
  }
  // apologize for long wait time
  waitApology = function() {
    $('#waitWarning').hide();
    if(! $('#display').is(":visible")) {
      $('#waitApology').show();
    }
  }
  setTimeout(waitApology, 15000);
  allCompaniesSuccess = function(companies) { // final success callback
    $('#loading').hide();
    // sort companies in-place by chosen metric
    glassSort(companies, metric);
    len = companies.length;
    // iteratively append companies to displayed results
    for (i = 0; i < len; i++) {
      try {
        cur = companies[i];
        el = $('<li></li>');
        el.append($("<a>", {href: cur.url, target: "_blank"}).text(cur.name));
        el.append("  (" + parseFloat(cur[""+ metric]).toFixed(1) + ")");
        $('#results>.companies').append(el);
      }
      catch(err) {
        continue;
      }
    }
    $('#display').show();
    if (len == 0) {
      $('#noResults').show();
    }
  }
  // promise for json attempt
  originalPromise = $.Deferred();
  // promise for jsonp attempt
  secondChance = $.Deferred();
  // error callback for json attempt
  jsonFailed = function(XMLHttpRequest, textStatus, errorThrown) {
    originalPromise.reject('try jsonp');
    throw "try jsonp"
  }
  // error callback for jsonp attempt
  getCompaniesFailed = function(XMLHttpRequest, textStatus, errorThrown) {
    console.log("ERROR: " + textStatus);
  }
  $.when(// Glassdoor API request payload is constructed
    getParams()
  ).then(function(data) {// attempt to get companies data as json
    $.when(
      getCompaniesJSON(url, query, data, 'json', jsonFailed, originalPromise)
    ).then(allCompaniesSuccess).catch(function(err) { // json failed
      $.when( // attempt to get companies data as jsonp
        getCompaniesJSON(url, query, data, 'jsonp', getCompaniesFailed, secondChance)
      ).then(allCompaniesSuccess);
    });
  });
}