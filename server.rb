#!/usr/bin/env ruby

require 'sinatra'

get '/favicon.ico' do
  not_found
end

get '/*' do |filename|
  filename = 'index.html' if filename == ''
  if !system("make #{filename}")
    print 'make error'
    status 500
    halt
  end
  send_file filename
end
