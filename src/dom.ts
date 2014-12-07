/// <reference path="../typings/tsd.d.ts" />

function offable() {
  return {
    link: function(scope, element, attrs) {
      element.on('click', function(e) {
        var input = element.find('input');
        var modelCtrl = input.controller('ngModel');
        if (modelCtrl.$modelValue == input.val()) {
          modelCtrl.$setViewValue(null);
        } else {
          modelCtrl.$setViewValue(input.val());
        }
        e.preventDefault();
      });
    }
  };
}

function overlay() {
  return {
    link: function(scope, element, attrs) {
      var overlay = attrs['overlay'];
      element.on('mouseenter', function() { scope['ctrl'].overlay = overlay; });
      element.on('mouseleave', function() { scope['ctrl'].overlay = null; });
      element.addClass('overlay');
    }
  };
}
