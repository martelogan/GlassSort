$(document).ready(function() {
    $("form.search").submit(function() {
      var query = $('#query').val().split(',');
      showResults(query);
      return false;
    });
});

var showResults = function(query) {
  console.log(query);
}