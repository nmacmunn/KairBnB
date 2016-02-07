/* global console, $, _ */

'use strict';

var TIMEOUT = 500;

var headings = [
  'Room ID',
  'Host ID',
  'Room Type',
  'City',
  'Neighbourhood',
  'Address',
  'Nightly rate',
  'Reviews',
  'Overall satisfaction',
  'Accommodates',
  'Bedrooms',
  'Bathrooms',
  'Minimum Stay',
  'Latitude',
  'Longitude'
];


var getCity = function(city) {

  function getPage(data, donePage) {
    $.getJSON('/search/search_results', {
        page: data.page,
        location: city,
        price_min: data.min,
        price_max: data.max
      })
      .then(function(response) {
        if (data.page === 1) {
          console.log(response.logging_info.search.result.totalHits + ' from $' + (data.min || '0') + ' to $' + (data.max || '1000+'));
        }
        data.newIds = response.property_ids;
        donePage(data);
      }, function() {
        console.error('Error fetching results page ' + data.page + ' $' + data.min + '- $' + data.max);
      });
  }

  var getPriceRange = function(data, doneRange) {

    function nextPage(data) {
      //end condition
      if (!data.newIds || !data.newIds.length) {
        doneRange(data);
        return;
      }
      // update
      console.log(data.newIds);
      data.newIds.forEach(function(id) {
        data.properties[id] = undefined;
      });
      data.page += 1;
      // next
      setTimeout(function() {
        getPage(data, nextPage);
      }, TIMEOUT);
    }

    // initial
    getPage({
      page: 1,
      min: data.min,
      max: data.max,
      properties: data.properties
    }, nextPage);
  };

  var nextPriceRange = function(data) {
    // end condition
    if (!data.max) {
      console.log('found ' + _.size(data.properties) + ' total');
      getProperties(data.properties, function(data) {
        var nested = _.values(data);
        nested.unshift(headings);
        var csv = buildCSV(nested);
        saveCSV(csv, city);
      });
      return;
    }

    // update
    data.min = (data.min || 11) + 5;
    data.max += 5;
    data.max = data.max > 1000 ? undefined : data.max;

    // next
    getPriceRange(data, nextPriceRange);
  };

  // initial
  getPriceRange({
    city: city,
    min: undefined,
    max: 16,
    properties: {}
  }, nextPriceRange);

};

function buildCSV(data) {
  var content = 'data:text/csv;charset=utf-8,';
  var rows = data.map(function(row) {
    return row.join(',');
  });
  return content + rows.join('\n');
}

function saveCSV(content, city) {
  var encodedUri = encodeURI(content);
  var link = document.createElement('a');
  var date = new Date().toLocaleDateString();
  link.setAttribute('href', 'data:text/json;charset=utf-8,' + encodedUri);
  link.setAttribute('download', city + '-' + date + '.csv');
  link.click();
}

function getProperties(properties, done) {

  var roomId;
  _.find(properties, function(val, key) {
    if (val === undefined) {
      roomId = key;
      return true;
    }
  });

  // condition
  if (!roomId) {
    done(properties);
    return;
  }

  $.get('/rooms/' + roomId)
    .then(function(response) {
      var hostId, roomType, city, neighborhood, address, rate, reviews, rating,
        capacity, bedrooms, bathrooms, stay, latitude, longitude;
      var $el = $('<div>').append(response);
      var roomOptions = $el.find('#_bootstrap-room_options').attr('content');
      if (roomOptions) {
        var meta = JSON.parse(roomOptions);
        // var country = $el.find('meta[property="airbedandbreakfast:country"]').attr('content');
        city = $el.find('meta[property="airbedandbreakfast:city"]').attr('content');
        rating = parseFloat($el.find('meta[property="airbedandbreakfast:rating"]').attr('content')) || '';
        longitude = parseFloat($el.find('meta[property="airbedandbreakfast:location:longitude"]').attr('content'));
        latitude = parseFloat($el.find('meta[property="airbedandbreakfast:location:latitude"]').attr('content'));
        hostId = parseFloat($el.find('#host-profile a[href*="/users/show"]').attr('href').replace('/users/show/', ''));
        neighborhood = $el.find('a[href^="/locations/neighborhoods"]').text().trim();
        address = '"' + $el.find('#display-address').data('location') + '"';
        rate = parseFloat($el.find('#price_amount').text().replace('$', ''));
        rate = parseFloat($el.find('meta[itemprop="price"]').attr('content'));
        reviews = meta.airEventData.visible_review_count;
        // var satisfaction = meta.airEventData.guest_satisfaction_overall;
        roomType = meta.airEventData.room_type;
        capacity = meta.airEventData.person_capacity;
        bedrooms = parseFloat($el.find('div:contains("Bedrooms")>strong').text()) || '';
        bathrooms = parseFloat($el.find('div:contains("Bathrooms")>strong').text()) || '';
        stay = meta.minNights;
        $el.remove();
      }
      properties[roomId] = [
        roomId,
        hostId,
        roomType,
        city,
        neighborhood,
        address,
        rate,
        reviews,
        rating,
        capacity,
        bedrooms,
        bathrooms,
        stay,
        latitude,
        longitude
      ];
      console.log(properties[roomId]);
      setTimeout(function() {
        getProperties(properties, done);
      }, TIMEOUT);
    }, function() {
      console.error('Error fetching details for property ' + roomId);
    });
}

// getCity('Vancouver');
