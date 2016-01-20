$(document).ready(function() {
    $("form.search").submit(function() {
      var query = $('#query').val().split(',');
      showResults(query);
      return false;
    });
});

var getIp = function() {
  var promise = $.Deferred();
  $.ajax({
    url: "http://ipinfo.io",
    type: 'get',
    dataType: 'jsonp',
    success: function(result) {
      promise.resolve(result.ip);
    }
  });
  return promise;
}

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

var getCompanies = function(url, query, params) {
  var results = [], deferreds = [];
  var promise = $.Deferred();

  query.forEach(function(entry){
    params.q = entry;
    deferreds.push(
      $.ajax({
        url: url,
        type: "get",
        data: params,
        dataType: 'jsonp',
        success: function(JSON) {results.push(JSON.response.employers[0])},
        error: function(XMLHttpRequest, textStatus, errorThrown) { 
          alert("Status: " + textStatus);
        }        
      })
    );
  });
  
  $.when.apply($, deferreds).then(function() {
    promise.resolve(results);
  });

  return promise;
}

var showResults = function (query) {
  var url, el, i, cur;
  url = "http://api.glassdoor.com/api/api.htm";
  $.when(
    getParams()
  ).then(function(data) {
    $.when(
      getCompanies(url, query, data)
    ).then(function(companies) {
        console.log(companies);
    });
  });
}